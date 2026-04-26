package api

import (
	"github.com/gin-gonic/gin"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/api/handlers"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/api/middleware"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/repository/postgres"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

type Router struct {
	engine           *gin.Engine
	authMiddleware   *middleware.AuthMiddleware
	authHandler      *handlers.AuthHandler
	dashboardHandler *handlers.DashboardHandler
	accountHandler   *handlers.AccountHandler
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

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(userRepo, jwtSecret)
	dashboardHandler := handlers.NewDashboardHandler(costRepo, recommendationRepo, alertRepo)
	accountHandler := handlers.NewAccountHandler(accountRepo)
	authMiddleware := middleware.NewAuthMiddleware(jwtSecret)

	engine := gin.New()
	engine.Use(middleware.CORS())
	engine.Use(middleware.Logger(logger))
	engine.Use(gin.Recovery())

	router := &Router{
		engine:           engine,
		authMiddleware:   authMiddleware,
		authHandler:      authHandler,
		dashboardHandler: dashboardHandler,
		accountHandler:   accountHandler,
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
	}
}

func (r *Router) Run(addr string) error {
	return r.engine.Run(addr)
}
