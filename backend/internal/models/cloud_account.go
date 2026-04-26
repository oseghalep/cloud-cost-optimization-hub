package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CloudProvider string

const (
	ProviderAWS   CloudProvider = "aws"
	ProviderGCP   CloudProvider = "gcp"
	ProviderAzure CloudProvider = "azure"
)

type CloudAccount struct {
	ID          uuid.UUID     `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID      uuid.UUID     `gorm:"type:uuid;not null;index" json:"user_id"`
	Provider    CloudProvider `gorm:"type:varchar(20);not null" json:"provider"`
	Name        string        `gorm:"not null" json:"name"`
	AccountID   string        `gorm:"uniqueIndex:idx_account_provider" json:"account_id"`
	Credentials JSON          `gorm:"type:jsonb;not null" json:"-"` // Stored encrypted in production
	Status      string        `gorm:"default:'active'" json:"status"`
	LastSyncAt  *time.Time    `json:"last_sync_at"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

type JSON map[string]interface{}

func (CloudAccount) TableName() string {
	return "cloud_accounts"
}

func (c *CloudAccount) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
