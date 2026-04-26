package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/repository/postgres"
)

type DashboardHandler struct {
	costRepo           *postgres.CostRepository
	recommendationRepo *postgres.RecommendationRepository
	alertRepo          *postgres.AlertRepository
}

type DashboardSummary struct {
	TotalCost          float64                  `json:"total_cost"`
	CostByService      map[string]float64       `json:"cost_by_service"`
	Recommendations    int                      `json:"recommendations_count"`
	PotentialSavings   float64                  `json:"potential_savings"`
	UnreadAlerts       int                      `json:"unread_alerts"`
	DailyCosts         []DailyCost              `json:"daily_costs"`
	TopRecommendations []map[string]interface{} `json:"top_recommendations"`
}

type DailyCost struct {
	Date string  `json:"date"`
	Cost float64 `json:"cost"`
}

func NewDashboardHandler(
	costRepo *postgres.CostRepository,
	recommendationRepo *postgres.RecommendationRepository,
	alertRepo *postgres.AlertRepository,
) *DashboardHandler {
	return &DashboardHandler{
		costRepo:           costRepo,
		recommendationRepo: recommendationRepo,
		alertRepo:          alertRepo,
	}
}

func (h *DashboardHandler) GetSummary(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get date range (last 30 days)
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -30)

	// Get total cost
	totalCost, err := h.costRepo.GetTotalCost(userID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get total cost"})
		return
	}

	// Get cost by service
	costByService, err := h.costRepo.GetCostByService(userID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get cost by service"})
		return
	}

	// Get recommendations
	recommendations, err := h.recommendationRepo.FindAllByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get recommendations"})
		return
	}

	// Calculate potential savings
	var potentialSavings float64
	topRecommendations := make([]map[string]interface{}, 0)
	for i, rec := range recommendations {
		potentialSavings += rec.PotentialSavings
		if i < 5 {
			topRecommendations = append(topRecommendations, map[string]interface{}{
				"id":                rec.ID,
				"title":             rec.Title,
				"potential_savings": rec.PotentialSavings,
				"type":              rec.Type,
			})
		}
	}

	// Get unread alerts
	unreadAlerts, err := h.alertRepo.FindUnreadByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get alerts"})
		return
	}

	// For MVP, return mock daily costs (will be replaced with real data later)
	dailyCosts := generateMockDailyCosts()

	summary := DashboardSummary{
		TotalCost:          totalCost,
		CostByService:      costByService,
		Recommendations:    len(recommendations),
		PotentialSavings:   potentialSavings,
		UnreadAlerts:       len(unreadAlerts),
		DailyCosts:         dailyCosts,
		TopRecommendations: topRecommendations,
	}

	c.JSON(http.StatusOK, summary)
}

func (h *DashboardHandler) GetRecentCosts(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -7)

	costs, err := h.costRepo.GetCostsByAccount("", userID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get costs"})
		return
	}

	c.JSON(http.StatusOK, costs)
}

// Temporary mock function until real data is available
func generateMockDailyCosts() []DailyCost {
	costs := make([]DailyCost, 30)
	for i := 0; i < 30; i++ {
		date := time.Now().AddDate(0, 0, -i)
		costs[29-i] = DailyCost{
			Date: date.Format("2006-01-02"),
			Cost: float64(50 + i*2), // Mock increasing trend
		}
	}
	return costs
}
