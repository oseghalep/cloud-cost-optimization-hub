package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/repository/postgres"
)

type AccountHandler struct {
	accountRepo *postgres.CloudAccountRepository
}

type CreateAccountRequest struct {
	Provider    models.CloudProvider `json:"provider" binding:"required"`
	Name        string               `json:"name" binding:"required"`
	AccountID   string               `json:"account_id" binding:"required"`
	Credentials models.JSON          `json:"credentials" binding:"required"`
}

func NewAccountHandler(accountRepo *postgres.CloudAccountRepository) *AccountHandler {
	return &AccountHandler{
		accountRepo: accountRepo,
	}
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
