package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
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

// JSON is a custom type for JSONB fields that implements Scanner and Valuer
type JSON map[string]interface{}

// Value implements driver.Valuer for JSON (used when writing to DB)
func (j JSON) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements sql.Scanner for JSON (used when reading from DB)
func (j *JSON) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("failed to unmarshal JSON value: not a byte slice")
	}
	result := make(map[string]interface{})
	err := json.Unmarshal(bytes, &result)
	if err != nil {
		return err
	}
	*j = result
	return nil
}

type CloudAccount struct {
	ID          uuid.UUID     `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID      uuid.UUID     `gorm:"type:uuid;not null;index" json:"user_id"`
	Provider    CloudProvider `gorm:"type:varchar(20);not null" json:"provider"`
	Name        string        `gorm:"not null" json:"name"`
	AccountID   string        `gorm:"uniqueIndex:idx_account_provider" json:"account_id"`
	Credentials JSON          `gorm:"type:jsonb;not null" json:"-"`
	Status      string        `gorm:"default:'active'" json:"status"`
	LastSyncAt  *time.Time    `json:"last_sync_at"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

func (CloudAccount) TableName() string {
	return "cloud_accounts"
}

func (c *CloudAccount) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
