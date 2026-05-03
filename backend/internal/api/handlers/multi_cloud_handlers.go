package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/repository/postgres"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/services/cost_ingestion"
)

type MultiCloudHandler struct {
	accountRepo  *postgres.CloudAccountRepository
	gcpService   *cost_ingestion.GCPService
	azureService *cost_ingestion.AzureService
}

type AddGCPAccountRequest struct {
	Name        string `json:"name" binding:"required"`
	ProjectID   string `json:"project_id" binding:"required"`
	PrivateKey  string `json:"private_key" binding:"required"`
	ClientEmail string `json:"client_email" binding:"required"`
}

type AddAzureAccountRequest struct {
	Name           string `json:"name" binding:"required"`
	SubscriptionID string `json:"subscription_id" binding:"required"`
	ClientID       string `json:"client_id" binding:"required"`
	ClientSecret   string `json:"client_secret" binding:"required"`
	TenantID       string `json:"tenant_id" binding:"required"`
}

func NewMultiCloudHandler(
	accountRepo *postgres.CloudAccountRepository,
	gcpService *cost_ingestion.GCPService,
	azureService *cost_ingestion.AzureService,
) *MultiCloudHandler {
	return &MultiCloudHandler{
		accountRepo:  accountRepo,
		gcpService:   gcpService,
		azureService: azureService,
	}
}

func (h *MultiCloudHandler) AddGCPAccount(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req AddGCPAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	credentials := models.JSON{
		"project_id":   req.ProjectID,
		"private_key":  req.PrivateKey,
		"client_email": req.ClientEmail,
	}

	account := &models.CloudAccount{
		UserID:      parsedUserID,
		Provider:    models.ProviderGCP,
		Name:        req.Name,
		AccountID:   req.ProjectID,
		Credentials: credentials,
		Status:      "active",
	}

	if err := h.accountRepo.Create(account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}

	// Trigger initial cost fetch
	go func() {
		if err := h.gcpService.FetchAndStoreCosts(account); err != nil {
			println("Failed to fetch GCP costs:", err.Error())
		}
	}()

	c.JSON(http.StatusCreated, gin.H{
		"message": "GCP account added successfully",
		"account": account,
	})
}

func (h *MultiCloudHandler) AddAzureAccount(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req AddAzureAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	credentials := models.JSON{
		"subscription_id": req.SubscriptionID,
		"client_id":       req.ClientID,
		"client_secret":   req.ClientSecret,
		"tenant_id":       req.TenantID,
	}

	account := &models.CloudAccount{
		UserID:      parsedUserID,
		Provider:    models.ProviderAzure,
		Name:        req.Name,
		AccountID:   req.SubscriptionID,
		Credentials: credentials,
		Status:      "active",
	}

	if err := h.accountRepo.Create(account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}

	// Trigger initial cost fetch
	go func() {
		if err := h.azureService.FetchAndStoreCosts(account); err != nil {
			println("Failed to fetch Azure costs:", err.Error())
		}
	}()

	c.JSON(http.StatusCreated, gin.H{
		"message": "Azure account added successfully",
		"account": account,
	})
}
