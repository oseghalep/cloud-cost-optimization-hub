package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
)

func main() {
	// Parse command line flags
	var direction string
	flag.StringVar(&direction, "direction", "up", "Migration direction (up or down)")
	flag.Parse()

	// Load .env file (for local development)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Build DSN – prefer DATABASE_URL (Railway) first
	var dsn string
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		dsn = dbURL
		log.Println("Using DATABASE_URL")
	} else {
		// Fallback to individual config variables (local development)
		dbHost := os.Getenv("DB_HOST")
		if dbHost == "" {
			dbHost = "localhost"
		}
		dbPort := os.Getenv("DB_PORT")
		if dbPort == "" {
			dbPort = "5432"
		}
		dbUser := os.Getenv("DB_USER")
		if dbUser == "" {
			dbUser = "ccoh"
		}
		dbPassword := os.Getenv("DB_PASSWORD")
		if dbPassword == "" {
			dbPassword = "ccoh123"
		}
		dbName := os.Getenv("DB_NAME")
		if dbName == "" {
			dbName = "ccoh"
		}
		dsn = fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
			dbHost, dbUser, dbPassword, dbName, dbPort,
		)
		log.Println("Using individual DB variables")
	}

	// Connect to database
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Connected to database successfully")

	if direction == "up" {
		log.Println("Running migrations UP...")
		if err := runMigrationsUp(db); err != nil {
			log.Fatalf("Migration failed: %v", err)
		}
		log.Println("Migrations completed successfully")
	} else if direction == "down" {
		log.Println("Running migrations DOWN...")
		if err := runMigrationsDown(db); err != nil {
			log.Fatalf("Migration failed: %v", err)
		}
		log.Println("Migrations rolled back successfully")
	} else {
		log.Fatalf("Invalid direction: %s. Use 'up' or 'down'", direction)
	}
}

func runMigrationsUp(db *gorm.DB) error {
	// Auto migrate in correct order
	if err := db.AutoMigrate(&models.User{}); err != nil {
		return fmt.Errorf("failed to migrate users table: %w", err)
	}
	log.Println("✓ users table migrated")

	if err := db.AutoMigrate(&models.CloudAccount{}); err != nil {
		return fmt.Errorf("failed to migrate cloud_accounts table: %w", err)
	}
	log.Println("✓ cloud_accounts table migrated")

	if err := db.AutoMigrate(&models.CostRecord{}); err != nil {
		return fmt.Errorf("failed to migrate cost_records table: %w", err)
	}
	log.Println("✓ cost_records table migrated")

	if err := db.AutoMigrate(&models.Recommendation{}); err != nil {
		return fmt.Errorf("failed to migrate recommendations table: %w", err)
	}
	log.Println("✓ recommendations table migrated")

	if err := db.AutoMigrate(&models.Alert{}); err != nil {
		return fmt.Errorf("failed to migrate alerts table: %w", err)
	}
	log.Println("✓ alerts table migrated")

	return nil
}

func runMigrationsDown(db *gorm.DB) error {
	// Drop tables in reverse order
	if err := db.Migrator().DropTable(&models.Alert{}); err != nil {
		return fmt.Errorf("failed to drop alerts table: %w", err)
	}
	log.Println("✓ alerts table dropped")

	if err := db.Migrator().DropTable(&models.Recommendation{}); err != nil {
		return fmt.Errorf("failed to drop recommendations table: %w", err)
	}
	log.Println("✓ recommendations table dropped")

	if err := db.Migrator().DropTable(&models.CostRecord{}); err != nil {
		return fmt.Errorf("failed to drop cost_records table: %w", err)
	}
	log.Println("✓ cost_records table dropped")

	if err := db.Migrator().DropTable(&models.CloudAccount{}); err != nil {
		return fmt.Errorf("failed to drop cloud_accounts table: %w", err)
	}
	log.Println("✓ cloud_accounts table dropped")

	if err := db.Migrator().DropTable(&models.User{}); err != nil {
		return fmt.Errorf("failed to drop users table: %w", err)
	}
	log.Println("✓ users table dropped")

	return nil
}
