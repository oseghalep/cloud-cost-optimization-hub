package api

import (
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"gorm.io/gorm"

	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/api/handlers"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/api/middleware"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/repository/postgres"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/services/cost_ingestion"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/services/recommendations"
)

type Router struct {
	engine                *gin.Engine
	authMiddleware        *middleware.AuthMiddleware
	authHandler           *handlers.AuthHandler
	dashboardHandler      *handlers.DashboardHandler
	accountHandler        *handlers.AccountHandler
	awsCredsHandler       *handlers.AWSCredentialsHandler
	recommendationHandler *handlers.RecommendationHandler
	multiCloudHandler     *handlers.MultiCloudHandler
}

func NewRouter(
	db *gorm.DB,
	logger *zerolog.Logger,
	jwtSecret string,
) *Router {
	// Initialize repositories
	userRepo := postgres.NewUserRepository(db)
	accountRepo := postgres.NewCloudAccountRepository(db)
	costRepo := postgres.NewCostRepository(db)
	recommendationRepo := postgres.NewRecommendationRepository(db)
	alertRepo := postgres.NewAlertRepository(db)

	// Initialize AWS service
	awsService := cost_ingestion.NewAWSService(accountRepo, costRepo, logger)

	// Create GCP and Azure services
	gcpService := cost_ingestion.NewGCPService(accountRepo, costRepo, logger)
	azureService := cost_ingestion.NewAzureService(accountRepo, costRepo, logger)

	// Create multi-cloud handler
	multiCloudHandler := handlers.NewMultiCloudHandler(accountRepo, gcpService, azureService)

	// Initialize recommendation engine
	recommendationEngine := recommendations.NewRecommendationEngine(costRepo, recommendationRepo, accountRepo, logger)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(userRepo, jwtSecret)
	dashboardHandler := handlers.NewDashboardHandler(costRepo, recommendationRepo, alertRepo)
	accountHandler := handlers.NewAccountHandler(accountRepo, awsService, gcpService, azureService)
	awsCredsHandler := handlers.NewAWSCredentialsHandler(accountRepo, awsService)
	recommendationHandler := handlers.NewRecommendationHandler(recommendationRepo, recommendationEngine)

	authMiddleware := middleware.NewAuthMiddleware(jwtSecret)

	engine := gin.New()
	engine.Use(middleware.CORS())
	engine.Use(middleware.Logger(logger))
	engine.Use(gin.Recovery())

	router := &Router{
		engine:                engine,
		authMiddleware:        authMiddleware,
		authHandler:           authHandler,
		dashboardHandler:      dashboardHandler,
		accountHandler:        accountHandler,
		awsCredsHandler:       awsCredsHandler,
		recommendationHandler: recommendationHandler,
		multiCloudHandler:     multiCloudHandler,
	}

	router.setupRoutes()
	return router
}

func (r *Router) setupRoutes() {
	// Health check
	r.engine.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Public routes
	authGroup := r.engine.Group("/api/v1/auth")
	{
		authGroup.POST("/register", r.authHandler.Register)
		authGroup.POST("/login", r.authHandler.Login)
	}

	// Protected routes
	protected := r.engine.Group("/api/v1")
	protected.Use(r.authMiddleware.Authenticate())
	{
		protected.GET("/auth/me", r.authHandler.Me)
		protected.GET("/dashboard/summary", r.dashboardHandler.GetSummary)
		protected.GET("/dashboard/costs", r.dashboardHandler.GetRecentCosts)

		// Account routes
		protected.POST("/accounts", r.accountHandler.Create)
		protected.GET("/accounts", r.accountHandler.List)
		protected.GET("/accounts/:id", r.accountHandler.Get)
		protected.DELETE("/accounts/:id", r.accountHandler.Delete)
		protected.POST("/accounts/:id/sync", r.accountHandler.Sync)

		// AWS Account routes
		protected.POST("/aws/accounts", r.awsCredsHandler.AddAWSAccount)
		protected.POST("/aws/test-connection", r.awsCredsHandler.TestConnection)

		// GCP and Azure Account routes
		protected.POST("/gcp/accounts", r.multiCloudHandler.AddGCPAccount)
		protected.POST("/azure/accounts", r.multiCloudHandler.AddAzureAccount)

		// Recommendation routes
		protected.GET("/recommendations", r.recommendationHandler.List)
		protected.GET("/recommendations/account/:accountId", r.recommendationHandler.GetByAccount)
		protected.PATCH("/recommendations/:id/dismiss", r.recommendationHandler.Dismiss)
		protected.POST("/recommendations/:id/apply", r.recommendationHandler.Apply)
		protected.POST("/recommendations/generate", r.recommendationHandler.Generate)
	}
}

// GetEngine returns the underlying gin engine
func (r *Router) GetEngine() *gin.Engine {
	return r.engine
}
