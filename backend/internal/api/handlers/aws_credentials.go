package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/repository/postgres"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/services/cost_ingestion"
)

type AWSCredentialsHandler struct {
	accountRepo *postgres.CloudAccountRepository
	awsService  *cost_ingestion.AWSService
}

type AddAWSAccountRequest struct {
	Name        string `json:"name" binding:"required"`
	AccountID   string `json:"account_id" binding:"required"`
	AccessKeyID string `json:"access_key_id" binding:"required"`
	SecretKey   string `json:"secret_access_key" binding:"required"`
	Region      string `json:"region" binding:"required"`
}

func NewAWSCredentialsHandler(
	accountRepo *postgres.CloudAccountRepository,
	awsService *cost_ingestion.AWSService,
) *AWSCredentialsHandler {
	return &AWSCredentialsHandler{
		accountRepo: accountRepo,
		awsService:  awsService,
	}
}

func (h *AWSCredentialsHandler) AddAWSAccount(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req AddAWSAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Store credentials as models.JSON (map[string]interface{})
	credentials := models.JSON{
		"access_key_id":     req.AccessKeyID,
		"secret_access_key": req.SecretKey,
		"region":            req.Region,
	}

	account := &models.CloudAccount{
		UserID:      parsedUserID,
		Provider:    models.ProviderAWS,
		Name:        req.Name,
		AccountID:   req.AccountID,
		Credentials: credentials,
		Status:      "active",
	}

	if err := h.accountRepo.Create(account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}

	// Trigger initial cost fetch in background
	go func() {
		if err := h.awsService.FetchAndStoreCosts(account); err != nil {
			println("Failed to fetch initial costs:", err.Error())
		}
	}()

	c.JSON(http.StatusCreated, gin.H{
		"message": "AWS account added successfully",
		"account": account,
	})
}

func (h *AWSCredentialsHandler) TestConnection(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req struct {
		AccessKeyID string `json:"access_key_id" binding:"required"`
		SecretKey   string `json:"secret_access_key" binding:"required"`
		Region      string `json:"region" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create credentials as models.JSON (map[string]interface{})
	credentials := models.JSON{
		"access_key_id":     req.AccessKeyID,
		"secret_access_key": req.SecretKey,
		"region":            req.Region,
	}

	testAccount := &models.CloudAccount{
		Credentials: credentials,
		Provider:    models.ProviderAWS,
	}

	// Test the connection
	err := h.awsService.FetchAndStoreCosts(testAccount)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Connection failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Connection successful"})
}
