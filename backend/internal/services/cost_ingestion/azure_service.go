package cost_ingestion

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/repository/postgres"
)

type AzureService struct {
	accountRepo *postgres.CloudAccountRepository
	costRepo    *postgres.CostRepository
	logger      *zerolog.Logger
}

type AzureCredentials struct {
	SubscriptionID string `json:"subscription_id"`
	ClientID       string `json:"client_id"`
	ClientSecret   string `json:"client_secret"`
	TenantID       string `json:"tenant_id"`
}

func NewAzureService(
	accountRepo *postgres.CloudAccountRepository,
	costRepo *postgres.CostRepository,
	logger *zerolog.Logger,
) *AzureService {
	return &AzureService{
		accountRepo: accountRepo,
		costRepo:    costRepo,
		logger:      logger,
	}
}

func (s *AzureService) FetchAndStoreCosts(account *models.CloudAccount) error {
	s.logger.Info().Str("account_id", account.ID.String()).Msg("Fetching Azure costs")

	// Extract credentials
	creds := AzureCredentials{}

	if subID, ok := account.Credentials["subscription_id"].(string); ok {
		creds.SubscriptionID = subID
	}
	if clientID, ok := account.Credentials["client_id"].(string); ok {
		creds.ClientID = clientID
	}
	if tenantID, ok := account.Credentials["tenant_id"].(string); ok {
		creds.TenantID = tenantID
	}

	if creds.SubscriptionID == "" {
		return fmt.Errorf("missing Azure subscription ID")
	}

	// For MVP, generate sample costs
	// In production, you'll integrate with Azure Cost Management API
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -30)

	var costs []models.CostRecord
	currentDate := startDate

	for currentDate.Before(endDate) {
		cost := models.CostRecord{
			ID:         uuid.New(),
			AccountID:  account.ID,
			Provider:   models.ProviderAzure,
			Service:    "compute",
			Region:     "global",
			ResourceID: fmt.Sprintf("azure-%s-%s", creds.SubscriptionID, currentDate.Format("2006-01-02")),
			Amount:     35.75,
			Currency:   "USD",
			Date:       currentDate,
		}
		costs = append(costs, cost)
		currentDate = currentDate.AddDate(0, 0, 1)
	}

	// Replace the window rather than appending, so repeated syncs don't stack
	// duplicate rows. Skipped for test connections, which carry no account ID.
	if account.ID != uuid.Nil {
		if err := s.costRepo.ReplaceAccountRange(account.ID, startDate, endDate, costs); err != nil {
			return fmt.Errorf("failed to store Azure costs: %w", err)
		}
		s.logger.Info().Int("count", len(costs)).Msg("Stored Azure costs")
	}

	if account.ID != uuid.Nil {
		s.accountRepo.UpdateLastSync(account.ID.String())
	}

	return nil
}
