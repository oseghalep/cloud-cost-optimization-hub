package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/repository/postgres"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/services/recommendations"
)

type RecommendationHandler struct {
	recommendationRepo   *postgres.RecommendationRepository
	recommendationEngine *recommendations.RecommendationEngine
}

func NewRecommendationHandler(
	recommendationRepo *postgres.RecommendationRepository,
	recommendationEngine *recommendations.RecommendationEngine,
) *RecommendationHandler {
	return &RecommendationHandler{
		recommendationRepo:   recommendationRepo,
		recommendationEngine: recommendationEngine,
	}
}

func (h *RecommendationHandler) List(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	recommendations, err := h.recommendationRepo.FindAllByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get recommendations"})
		return
	}

	c.JSON(http.StatusOK, recommendations)
}

func (h *RecommendationHandler) GetByAccount(c *gin.Context) {
	userID := c.GetString("userID")
	accountID := c.Param("accountId")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	recommendations, err := h.recommendationRepo.FindByAccountID(accountID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get recommendations"})
		return
	}

	c.JSON(http.StatusOK, recommendations)
}

func (h *RecommendationHandler) Dismiss(c *gin.Context) {
	userID := c.GetString("userID")
	recommendationID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	if err := h.recommendationRepo.UpdateStatus(recommendationID, models.RecommendationStatusDismissed); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to dismiss recommendation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Recommendation dismissed"})
}

func (h *RecommendationHandler) Apply(c *gin.Context) {
	userID := c.GetString("userID")
	recommendationID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// TODO: Implement actual resource modification
	// For now, just mark as applied

	if err := h.recommendationRepo.UpdateStatus(recommendationID, models.RecommendationStatusApplied); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to apply recommendation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Recommendation applied"})
}

func (h *RecommendationHandler) Generate(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Generate recommendations in background
	go func() {
		if err := h.recommendationEngine.GenerateAllRecommendations(userID); err != nil {
			// Log error (would use proper logger in production)
			println("Failed to generate recommendations:", err.Error())
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{"message": "Recommendation generation started"})
}
