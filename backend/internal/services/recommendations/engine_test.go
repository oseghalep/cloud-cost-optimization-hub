package recommendations

import (
	"errors"
	"io"
	"math"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
)

type mockRecommendationRepository struct {
	created           []models.Recommendation
	deletedAccountIDs []string
	createErr         error
}

type mockAccountRepository struct {
	accounts []models.CloudAccount
	err      error
}

func (m *mockAccountRepository) FindAllByUserID(userID string) ([]models.CloudAccount, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.accounts, nil
}

func (m *mockRecommendationRepository) Create(rec *models.Recommendation) error {
	if m.createErr != nil {
		return m.createErr
	}
	m.created = append(m.created, *rec)
	return nil
}

func (m *mockRecommendationRepository) DeleteByAccountID(accountID string) error {
	m.deletedAccountIDs = append(m.deletedAccountIDs, accountID)
	return nil
}

func newTestEngine(repo *mockRecommendationRepository) *RecommendationEngine {
	logger := zerolog.New(io.Discard)
	return &RecommendationEngine{
		recommendationRepo: repo,
		logger:             &logger,
	}
}

func TestCalculateSavings(t *testing.T) {
	tests := []struct {
		name            string
		currentHourly   float64
		suggestedHourly float64
		want            float64
	}{
		{
			name:            "ec2 downsize monthly savings",
			currentHourly:   0.096,
			suggestedHourly: 0.021,
			want:            54.00,
		},
		{
			name:            "rds downsize monthly savings",
			currentHourly:   0.384,
			suggestedHourly: 0.192,
			want:            138.24,
		},
		{
			name:            "no negative savings",
			currentHourly:   0.021,
			suggestedHourly: 0.096,
			want:            0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := calculateSavings(tt.currentHourly, tt.suggestedHourly)
			assertFloatEqual(t, got, tt.want)
		})
	}
}

func TestGenerateAllRecommendations(t *testing.T) {
	userID := uuid.New()

	tests := []struct {
		name           string
		accounts       []models.CloudAccount
		accountErr     error
		wantErr        bool
		wantCreated    int
		wantDeleteCall int
	}{
		{
			name: "creates recommendations for AWS accounts",
			accounts: []models.CloudAccount{
				{ID: uuid.New(), UserID: userID, Provider: models.ProviderAWS},
			},
			wantCreated:    4,
			wantDeleteCall: 1,
		},
		{
			name: "skips non-AWS accounts",
			accounts: []models.CloudAccount{
				{ID: uuid.New(), UserID: userID, Provider: models.ProviderGCP},
			},
		},
		{
			name:       "returns account lookup errors",
			accountErr: errors.New("account lookup failed"),
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recommendationRepo := &mockRecommendationRepository{}
			accountRepo := &mockAccountRepository{accounts: tt.accounts, err: tt.accountErr}
			logger := zerolog.New(io.Discard)
			engine := &RecommendationEngine{
				recommendationRepo: recommendationRepo,
				accountRepo:        accountRepo,
				logger:             &logger,
			}

			err := engine.GenerateAllRecommendations(userID.String())
			if (err != nil) != tt.wantErr {
				t.Fatalf("GenerateAllRecommendations() error = %v, wantErr %v", err, tt.wantErr)
			}
			if len(recommendationRepo.created) != tt.wantCreated {
				t.Fatalf("created recommendations = %d, want %d", len(recommendationRepo.created), tt.wantCreated)
			}
			if len(recommendationRepo.deletedAccountIDs) != tt.wantDeleteCall {
				t.Fatalf("DeleteByAccountID calls = %d, want %d", len(recommendationRepo.deletedAccountIDs), tt.wantDeleteCall)
			}
		})
	}
}

func TestGenerateRightsizingRecommendations(t *testing.T) {
	account := &models.CloudAccount{ID: uuid.New(), Provider: models.ProviderAWS}

	tests := []struct {
		name       string
		createErr  error
		wantErr    bool
		wantCount  int
		wantDelete bool
	}{
		{
			name:       "creates sample rightsizing recommendations with calculated savings",
			wantCount:  2,
			wantDelete: true,
		},
		{
			name:       "returns create errors",
			createErr:  errors.New("insert failed"),
			wantErr:    true,
			wantDelete: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &mockRecommendationRepository{createErr: tt.createErr}
			engine := newTestEngine(repo)

			err := engine.generateRightsizingRecommendations(account)
			if (err != nil) != tt.wantErr {
				t.Fatalf("generateRightsizingRecommendations() error = %v, wantErr %v", err, tt.wantErr)
			}

			if got := len(repo.deletedAccountIDs); tt.wantDelete && got != 1 {
				t.Fatalf("DeleteByAccountID calls = %d, want 1", got)
			}
			if tt.wantDelete && repo.deletedAccountIDs[0] != account.ID.String() {
				t.Fatalf("DeleteByAccountID account = %q, want %q", repo.deletedAccountIDs[0], account.ID.String())
			}

			if len(repo.created) != tt.wantCount {
				t.Fatalf("created recommendations = %d, want %d", len(repo.created), tt.wantCount)
			}
			if tt.wantErr {
				return
			}

			assertRecommendation(t, repo.created[0], account.ID, models.RecommendationRightsizing, "i-1234567890", "ec2-instance", 54.00)
			assertRecommendation(t, repo.created[1], account.ID, models.RecommendationRightsizing, "db-EXAMPLE", "rds-instance", 138.24)
		})
	}
}

func TestGenerateIdleResourceRecommendations(t *testing.T) {
	account := &models.CloudAccount{ID: uuid.New(), Provider: models.ProviderAWS}
	repo := &mockRecommendationRepository{}
	engine := newTestEngine(repo)

	if err := engine.generateIdleResourceRecommendations(account); err != nil {
		t.Fatalf("generateIdleResourceRecommendations() error = %v", err)
	}

	if len(repo.created) != 2 {
		t.Fatalf("created recommendations = %d, want 2", len(repo.created))
	}

	assertRecommendation(t, repo.created[0], account.ID, models.RecommendationOrphaned, "vol-1234567890", "ebs-volume", 10.00)
	assertRecommendation(t, repo.created[1], account.ID, models.RecommendationOrphaned, "eipalloc-1234567890", "elastic-ip", 7.20)
}

func assertRecommendation(
	t *testing.T,
	rec models.Recommendation,
	accountID uuid.UUID,
	recType models.RecommendationType,
	resourceID string,
	resourceType string,
	potentialSavings float64,
) {
	t.Helper()

	if rec.ID == uuid.Nil {
		t.Fatal("recommendation ID is empty")
	}
	if rec.AccountID != accountID {
		t.Fatalf("AccountID = %s, want %s", rec.AccountID, accountID)
	}
	if rec.Type != recType {
		t.Fatalf("Type = %s, want %s", rec.Type, recType)
	}
	if rec.ResourceID != resourceID {
		t.Fatalf("ResourceID = %q, want %q", rec.ResourceID, resourceID)
	}
	if rec.ResourceType != resourceType {
		t.Fatalf("ResourceType = %q, want %q", rec.ResourceType, resourceType)
	}
	if rec.Currency != "USD" {
		t.Fatalf("Currency = %q, want USD", rec.Currency)
	}
	if rec.Status != models.RecommendationStatusPending {
		t.Fatalf("Status = %q, want %q", rec.Status, models.RecommendationStatusPending)
	}
	assertFloatEqual(t, rec.PotentialSavings, potentialSavings)
}

func assertFloatEqual(t *testing.T, got, want float64) {
	t.Helper()

	if math.Abs(got-want) > 0.000001 {
		t.Fatalf("got %f, want %f", got, want)
	}
}
