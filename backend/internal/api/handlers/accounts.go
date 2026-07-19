package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/repository/postgres"
)

// CostSyncer is any provider service that can pull and store costs for an account.
type CostSyncer interface {
	FetchAndStoreCosts(account *models.CloudAccount) error
}

type AccountHandler struct {
	accountRepo  *postgres.CloudAccountRepository
	awsService   CostSyncer
	gcpService   CostSyncer
	azureService CostSyncer
}

type CreateAccountRequest struct {
	Provider    models.CloudProvider `json:"provider" binding:"required"`
	Name        string               `json:"name" binding:"required"`
	AccountID   string               `json:"account_id" binding:"required"`
	Credentials models.JSON          `json:"credentials" binding:"required"`
}

func NewAccountHandler(
	accountRepo *postgres.CloudAccountRepository,
	awsService CostSyncer,
	gcpService CostSyncer,
	azureService CostSyncer,
) *AccountHandler {
	return &AccountHandler{
		accountRepo:  accountRepo,
		awsService:   awsService,
		gcpService:   gcpService,
		azureService: azureService,
	}
}

// Sync pulls fresh costs for one account and stamps last_sync_at on success.
// Runs synchronously so the caller learns whether the sync actually worked,
// unlike the fire-and-forget goroutine used when an account is first added.
func (h *AccountHandler) Sync(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	account, err := h.accountRepo.FindByID(c.Param("id"), userID)
	if err != nil || account == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Account not found"})
		return
	}

	var syncer CostSyncer
	switch account.Provider {
	case models.ProviderAWS:
		syncer = h.awsService
	case models.ProviderGCP:
		syncer = h.gcpService
	case models.ProviderAzure:
		syncer = h.azureService
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported provider"})
		return
	}

	if syncer == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sync unavailable for this provider"})
		return
	}

	// Status is written column-only. A full Save() here would push the stale
	// in-memory last_sync_at back over the fresh value the sync just wrote.
	if syncErr := syncer.FetchAndStoreCosts(account); syncErr != nil {
		if err := h.accountRepo.UpdateStatus(account.ID.String(), userID, "error"); err != nil {
			log.Printf("sync: failed to mark account %s as error: %v", account.ID, err)
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": "Sync failed: " + syncErr.Error()})
		return
	}

	if err := h.accountRepo.UpdateStatus(account.ID.String(), userID, "active"); err != nil {
		log.Printf("sync: failed to mark account %s as active: %v", account.ID, err)
	}

	updated, err := h.accountRepo.FindByID(account.ID.String(), userID)
	if err != nil || updated == nil {
		c.JSON(http.StatusOK, gin.H{"message": "Sync successful"})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *AccountHandler) Create(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req CreateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse userID to UUID
	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	account := &models.CloudAccount{
		UserID:      parsedUserID,
		Provider:    req.Provider,
		Name:        req.Name,
		AccountID:   req.AccountID,
		Credentials: req.Credentials,
		Status:      "active",
	}

	if err := h.accountRepo.Create(account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}

	c.JSON(http.StatusCreated, account)
}

func (h *AccountHandler) List(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	accounts, err := h.accountRepo.FindAllByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list accounts"})
		return
	}

	c.JSON(http.StatusOK, accounts)
}

func (h *AccountHandler) Get(c *gin.Context) {
	userID := c.GetString("userID")
	accountID := c.Param("id")

	account, err := h.accountRepo.FindByID(accountID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Account not found"})
		return
	}

	c.JSON(http.StatusOK, account)
}

func (h *AccountHandler) Delete(c *gin.Context) {
	userID := c.GetString("userID")
	accountID := c.Param("id")

	if err := h.accountRepo.Delete(accountID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Account deleted successfully"})
}
