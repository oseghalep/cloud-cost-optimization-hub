package cost_ingestion

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/costexplorer"
	"github.com/aws/aws-sdk-go-v2/service/costexplorer/types"
	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/repository/postgres"
)

type AWSService struct {
	accountRepo *postgres.CloudAccountRepository
	costRepo    *postgres.CostRepository
	logger      *zerolog.Logger
}

type AWSCredentials struct {
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`
	Region          string `json:"region"`
}

func NewAWSService(
	accountRepo *postgres.CloudAccountRepository,
	costRepo *postgres.CostRepository,
	logger *zerolog.Logger,
) *AWSService {
	return &AWSService{
		accountRepo: accountRepo,
		costRepo:    costRepo,
		logger:      logger,
	}
}

// FetchAndStoreCosts fetches costs from AWS and stores them in the database
func (s *AWSService) FetchAndStoreCosts(account *models.CloudAccount) error {
	s.logger.Info().Str("account_id", account.ID.String()).Msg("Fetching AWS costs")

	// Extract credentials from models.JSON
	creds := AWSCredentials{}

	if accessKey, ok := account.Credentials["access_key_id"].(string); ok {
		creds.AccessKeyID = accessKey
	}
	if secretKey, ok := account.Credentials["secret_access_key"].(string); ok {
		creds.SecretAccessKey = secretKey
	}
	if region, ok := account.Credentials["region"].(string); ok {
		creds.Region = region
	}

	if creds.AccessKeyID == "" || creds.SecretAccessKey == "" {
		return fmt.Errorf("missing AWS credentials")
	}

	if creds.Region == "" {
		creds.Region = "us-east-1"
	}

	// Create AWS config
	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(creds.Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			creds.AccessKeyID,
			creds.SecretAccessKey,
			"",
		)),
	)
	if err != nil {
		return fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Rest of the function remains the same...
	// Create Cost Explorer client
	ceClient := costexplorer.NewFromConfig(cfg)

	// Get last 30 days of cost data
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -30)

	// Fetch daily costs
	costs, err := s.getDailyCosts(ceClient, startDate, endDate, account)
	if err != nil {
		return fmt.Errorf("failed to get daily costs: %w", err)
	}

	// Fetch cost by service
	serviceCosts, err := s.getCostByService(ceClient, startDate, endDate, account)
	if err != nil {
		return fmt.Errorf("failed to get cost by service: %w", err)
	}

	// Combine costs
	allCosts := append(costs, serviceCosts...)

	// Store in database
	if len(allCosts) > 0 {
		if err := s.costRepo.BulkCreate(allCosts); err != nil {
			return fmt.Errorf("failed to store costs: %w", err)
		}
		s.logger.Info().Int("count", len(allCosts)).Msg("Stored AWS costs")
	}

	// Update last sync time (only if account has a valid ID - not for test connections)
	if account.ID != uuid.Nil {
		if err := s.accountRepo.UpdateLastSync(account.ID.String()); err != nil {
			s.logger.Error().Err(err).Msg("Failed to update last sync time")
		}
	}

	return nil
}

func (s *AWSService) getDailyCosts(
	client *costexplorer.Client,
	startDate, endDate time.Time,
	account *models.CloudAccount,
) ([]models.CostRecord, error) {
	start := startDate.Format("2006-01-02")
	end := endDate.Format("2006-01-02")

	input := &costexplorer.GetCostAndUsageInput{
		TimePeriod: &types.DateInterval{
			Start: aws.String(start),
			End:   aws.String(end),
		},
		Granularity: types.GranularityDaily,
		Metrics:     []string{"UnblendedCost"},
		GroupBy: []types.GroupDefinition{
			{
				Type: types.GroupDefinitionTypeDimension,
				Key:  aws.String("SERVICE"),
			},
		},
	}

	result, err := client.GetCostAndUsage(context.Background(), input)
	if err != nil {
		return nil, fmt.Errorf("failed to get cost and usage: %w", err)
	}

	var costs []models.CostRecord

	for _, resultByTime := range result.ResultsByTime {
		date, err := time.Parse("2006-01-02", *resultByTime.TimePeriod.Start)
		if err != nil {
			continue
		}

		for _, group := range resultByTime.Groups {
			if len(group.Keys) == 0 {
				continue
			}
			service := group.Keys[0]

			var amount float64
			if metric, ok := group.Metrics["UnblendedCost"]; ok && metric.Amount != nil {
				fmt.Sscanf(*metric.Amount, "%f", &amount)
			}

			cost := models.CostRecord{
				ID:         uuid.New(),
				AccountID:  account.ID,
				Provider:   models.ProviderAWS,
				Service:    service,
				Region:     "global",
				ResourceID: fmt.Sprintf("aws-%s-%s", service, *resultByTime.TimePeriod.Start),
				Amount:     amount,
				Currency:   "USD",
				Date:       date,
			}
			costs = append(costs, cost)
		}
	}

	return costs, nil
}

func (s *AWSService) getCostByService(
	client *costexplorer.Client,
	startDate, endDate time.Time,
	account *models.CloudAccount,
) ([]models.CostRecord, error) {
	start := startDate.Format("2006-01-02")
	end := endDate.Format("2006-01-02")

	input := &costexplorer.GetCostAndUsageInput{
		TimePeriod: &types.DateInterval{
			Start: aws.String(start),
			End:   aws.String(end),
		},
		Granularity: types.GranularityMonthly,
		Metrics:     []string{"UnblendedCost"},
		GroupBy: []types.GroupDefinition{
			{
				Type: types.GroupDefinitionTypeDimension,
				Key:  aws.String("SERVICE"),
			},
		},
	}

	result, err := client.GetCostAndUsage(context.Background(), input)
	if err != nil {
		return nil, fmt.Errorf("failed to get cost by service: %w", err)
	}

	var costs []models.CostRecord

	for _, resultByTime := range result.ResultsByTime {
		date, err := time.Parse("2006-01-02", *resultByTime.TimePeriod.Start)
		if err != nil {
			continue
		}

		for _, group := range resultByTime.Groups {
			if len(group.Keys) == 0 {
				continue
			}
			service := group.Keys[0]

			var amount float64
			if metric, ok := group.Metrics["UnblendedCost"]; ok && metric.Amount != nil {
				fmt.Sscanf(*metric.Amount, "%f", &amount)
			}

			cost := models.CostRecord{
				ID:         uuid.New(),
				AccountID:  account.ID,
				Provider:   models.ProviderAWS,
				Service:    service,
				Region:     "global",
				ResourceID: fmt.Sprintf("aws-%s-summary", service),
				Amount:     amount,
				Currency:   "USD",
				Date:       date,
			}
			costs = append(costs, cost)
		}
	}

	return costs, nil
}
