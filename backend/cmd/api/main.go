package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/api"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/pkg/config"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/pkg/db"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/pkg/logger"
)

func main() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Initialize logger
	log := logger.New(cfg.LogLevel)

	log.Info("Starting Cloud Cost Optimization Hub API Server")

	// Connect to database
	database, err := db.Connect(cfg, log)
	if err != nil {
		log.Fatal(fmt.Sprintf("Failed to connect to database: %v", err))
	}

	// Get underlying SQL DB for connection management
	sqlDB, err := database.DB()
	if err != nil {
		log.Fatal(fmt.Sprintf("Failed to get underlying SQL DB: %v", err))
	}
	defer sqlDB.Close()

	// Convert logger to zerolog for router
	zerologLogger := log.WithField("component", "http").Logger

	// Setup router
	router := api.NewRouter(database, &zerologLogger, cfg.JWTSecret)

	// Create HTTP server
	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      router.GetEngine(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Info(fmt.Sprintf("Server listening on port %s", cfg.Port))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(fmt.Sprintf("Failed to start server: %v", err))
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal(fmt.Sprintf("Server forced to shutdown: %v", err))
	}

	log.Info("Server exited gracefully")
}
