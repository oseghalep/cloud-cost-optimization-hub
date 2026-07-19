package cost_ingestion

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/repository/postgres"
)

type GCPService struct {
	accountRepo *postgres.CloudAccountRepository
	costRepo    *postgres.CostRepository
	logger      *zerolog.Logger
}

type GCPCredentials struct {
	ProjectID   string `json:"project_id"`
	PrivateKey  string `json:"private_key"`
	ClientEmail string `json:"client_email"`
	TokenURI    string `json:"token_uri"`
}

func NewGCPService(
	accountRepo *postgres.CloudAccountRepository,
	costRepo *postgres.CostRepository,
	logger *zerolog.Logger,
) *GCPService {
	return &GCPService{
		accountRepo: accountRepo,
		costRepo:    costRepo,
		logger:      logger,
	}
}

func (s *GCPService) FetchAndStoreCosts(account *models.CloudAccount) error {
	s.logger.Info().Str("account_id", account.ID.String()).Msg("Fetching GCP costs")

	// Extract credentials
	creds := GCPCredentials{}

	if projectID, ok := account.Credentials["project_id"].(string); ok {
		creds.ProjectID = projectID
	}
	if privateKey, ok := account.Credentials["private_key"].(string); ok {
		creds.PrivateKey = privateKey
	}
	if clientEmail, ok := account.Credentials["client_email"].(string); ok {
		creds.ClientEmail = clientEmail
	}

	if creds.ProjectID == "" {
		return fmt.Errorf("missing GCP project ID")
	}

	// For MVP, generate sample costs
	// In production, you'll integrate with GCP Cloud Billing API
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -30)

	var costs []models.CostRecord
	currentDate := startDate

	for currentDate.Before(endDate) {
		cost := models.CostRecord{
			ID:         uuid.New(),
			AccountID:  account.ID,
			Provider:   models.ProviderGCP,
			Service:    "compute-engine",
			Region:     "global",
			ResourceID: fmt.Sprintf("gcp-%s-%s", creds.ProjectID, currentDate.Format("2006-01-02")),
			Amount:     25.50,
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
			return fmt.Errorf("failed to store GCP costs: %w", err)
		}
		s.logger.Info().Int("count", len(costs)).Msg("Stored GCP costs")
	}

	if account.ID != uuid.Nil {
		s.accountRepo.UpdateLastSync(account.ID.String())
	}

	return nil
}
