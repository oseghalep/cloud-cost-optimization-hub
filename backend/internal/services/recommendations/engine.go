package recommendations

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/repository/postgres"
)

type RecommendationEngine struct {
	costRepo           costRepository
	recommendationRepo recommendationRepository
	accountRepo        accountRepository
	logger             *zerolog.Logger
}

type costRepository interface{}

type recommendationRepository interface {
	Create(rec *models.Recommendation) error
	DeleteByAccountID(accountID string) error
}

type accountRepository interface {
	FindAllByUserID(userID string) ([]models.CloudAccount, error)
}

type RightsizingSuggestion struct {
	ResourceID       string
	ResourceType     string
	CurrentType      string
	RecommendedType  string
	MonthlyCost      float64
	ProjectedSavings float64
}

type IdleResource struct {
	ResourceID   string
	ResourceType string
	DaysIdle     int
	MonthlyCost  float64
	Savings      float64
}

func NewRecommendationEngine(
	costRepo *postgres.CostRepository,
	recommendationRepo *postgres.RecommendationRepository,
	accountRepo *postgres.CloudAccountRepository,
	logger *zerolog.Logger,
) *RecommendationEngine {
	return &RecommendationEngine{
		costRepo:           costRepo,
		recommendationRepo: recommendationRepo,
		accountRepo:        accountRepo,
		logger:             logger,
	}
}

const hoursPerMonth = 24 * 30

func calculateSavings(currentHourlyCost, suggestedHourlyCost float64) float64 {
	savings := (currentHourlyCost - suggestedHourlyCost) * hoursPerMonth
	if savings < 0 {
		return 0
	}
	return savings
}

// GenerateAllRecommendations generates all types of recommendations for a user
func (e *RecommendationEngine) GenerateAllRecommendations(userID string) error {
	e.logger.Info().Str("user_id", userID).Msg("Generating recommendations")

	// Get all accounts for the user
	accounts, err := e.accountRepo.FindAllByUserID(userID)
	if err != nil {
		return fmt.Errorf("failed to get accounts: %w", err)
	}

	for _, account := range accounts {
		if account.Provider != models.ProviderAWS {
			continue // Start with AWS only
		}

		// Generate different types of recommendations
		if err := e.generateRightsizingRecommendations(&account); err != nil {
			e.logger.Error().Err(err).Str("account_id", account.ID.String()).Msg("Failed to generate rightsizing recommendations")
		}

		if err := e.generateIdleResourceRecommendations(&account); err != nil {
			e.logger.Error().Err(err).Str("account_id", account.ID.String()).Msg("Failed to generate idle resource recommendations")
		}
	}

	return nil
}

// generateRightsizingRecommendations finds over-provisioned resources
func (e *RecommendationEngine) generateRightsizingRecommendations(account *models.CloudAccount) error {
	// This is where you'd query AWS DescribeInstances API
	// For now, we'll create sample recommendations based on cost patterns

	// Delete old recommendations for this account
	e.recommendationRepo.DeleteByAccountID(account.ID.String())

	// Sample rightsizing recommendations (to be replaced with real AWS API calls)
	sampleRecommendations := []models.Recommendation{
		{
			ID:               uuid.New(),
			AccountID:        account.ID,
			Type:             models.RecommendationRightsizing,
			Title:            "Rightsize t3.large EC2 instance",
			Description:      "Instance i-1234567890 has average CPU utilization of 8% over 30 days. Consider downsizing to t3.small to save costs.",
			ResourceID:       "i-1234567890",
			ResourceType:     "ec2-instance",
			CurrentValue:     0.096, // $0.096 per hour for t3.large
			SuggestedValue:   0.021, // $0.021 per hour for t3.small
			PotentialSavings: calculateSavings(0.096, 0.021), // $54 per month
			Currency:         "USD",
			Status:           models.RecommendationStatusPending,
			Metadata: models.JSON{
				"instance_id":      "i-1234567890",
				"current_type":     "t3.large",
				"recommended_type": "t3.small",
				"cpu_utilization":  8,
				"days_analyzed":    30,
			},
		},
		{
			ID:               uuid.New(),
			AccountID:        account.ID,
			Type:             models.RecommendationRightsizing,
			Title:            "Rightsize r5.xlarge RDS instance",
			Description:      "Database instance has low connection count. Consider downsizing to r5.large.",
			ResourceID:       "db-EXAMPLE",
			ResourceType:     "rds-instance",
			CurrentValue:     0.384, // $0.384 per hour
			SuggestedValue:   0.192, // $0.192 per hour
			PotentialSavings: calculateSavings(0.384, 0.192),
			Currency:         "USD",
			Status:           models.RecommendationStatusPending,
			Metadata: models.JSON{
				"instance_id":      "db-EXAMPLE",
				"current_type":     "r5.xlarge",
				"recommended_type": "r5.large",
				"connections_avg":  25,
			},
		},
	}

	for _, rec := range sampleRecommendations {
		if err := e.recommendationRepo.Create(&rec); err != nil {
			return fmt.Errorf("failed to create recommendation: %w", err)
		}
	}

	e.logger.Info().Int("count", len(sampleRecommendations)).Str("account_id", account.ID.String()).Msg("Generated rightsizing recommendations")
	return nil
}

// generateIdleResourceRecommendations finds unused resources
func (e *RecommendationEngine) generateIdleResourceRecommendations(account *models.CloudAccount) error {
	sampleRecommendations := []models.Recommendation{
		{
			ID:               uuid.New(),
			AccountID:        account.ID,
			Type:             models.RecommendationOrphaned,
			Title:            "Unused EBS Volume",
			Description:      "Volume vol-1234567890 has been attached to a stopped instance for 45 days. Delete to save costs.",
			ResourceID:       "vol-1234567890",
			ResourceType:     "ebs-volume",
			CurrentValue:     10.00, // $10 per month for gp2 100GB
			SuggestedValue:   0,
			PotentialSavings: 10.00,
			Currency:         "USD",
			Status:           models.RecommendationStatusPending,
			Metadata: models.JSON{
				"volume_id":   "vol-1234567890",
				"size_gb":     100,
				"days_idle":   45,
				"attached_to": "i-terminated",
			},
		},
		{
			ID:               uuid.New(),
			AccountID:        account.ID,
			Type:             models.RecommendationOrphaned,
			Title:            "Unassociated Elastic IP",
			Description:      "Elastic IP 3.238.123.45 is not associated with any instance and incurs hourly charges.",
			ResourceID:       "eipalloc-1234567890",
			ResourceType:     "elastic-ip",
			CurrentValue:     7.20, // $0.005 per hour * 24 * 30
			SuggestedValue:   0,
			PotentialSavings: 7.20,
			Currency:         "USD",
			Status:           models.RecommendationStatusPending,
			Metadata: models.JSON{
				"allocation_id": "eipalloc-1234567890",
				"public_ip":     "3.238.123.45",
				"days_idle":     60,
			},
		},
	}

	for _, rec := range sampleRecommendations {
		if err := e.recommendationRepo.Create(&rec); err != nil {
			return fmt.Errorf("failed to create recommendation: %w", err)
		}
	}

	e.logger.Info().Int("count", len(sampleRecommendations)).Str("account_id", account.ID.String()).Msg("Generated idle resource recommendations")
	return nil
}

// GenerateRealRecommendations will integrate with AWS APIs to get real data
// This is a placeholder for the actual implementation
func (e *RecommendationEngine) GenerateRealRecommendations(account *models.CloudAccount) error {
	// TODO: Implement actual AWS API calls:
	// 1. EC2 DescribeInstances to get instance types and utilization
	// 2. CloudWatch GetMetricStatistics for CPU utilization
	// 3. RDS DescribeDBInstances for database instances
	// 4. EBS DescribeVolumes for unattached volumes
	// 5. EC2 DescribeAddresses for unassociated EIPs

	return nil
}
