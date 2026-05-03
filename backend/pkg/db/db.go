package db

import (
	"fmt"

	"github.com/oseghalep/cloud-cost-optimization-hub/backend/pkg/config"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/pkg/logger"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func Connect(cfg *config.Config, log *logger.Logger) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort,
	)

	var gormLogLevel gormlogger.LogLevel
	if cfg.IsProduction() {
		gormLogLevel = gormlogger.Silent
	} else {
		gormLogLevel = gormlogger.Info
	}

	gormLog := gormlogger.Default.LogMode(gormLogLevel)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormLog,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Get underlying SQL DB to configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying SQL DB: %w", err)
	}

	// Connection pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	log.Info("Database connected successfully")

	return db, nil
}
