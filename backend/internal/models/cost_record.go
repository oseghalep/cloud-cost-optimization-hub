package models

import (
	"time"

	"github.com/google/uuid"
)

type CostRecord struct {
	ID         uuid.UUID     `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	AccountID  uuid.UUID     `gorm:"type:uuid;not null;index" json:"account_id"`
	Provider   CloudProvider `gorm:"type:varchar(20);not null" json:"provider"`
	Service    string        `gorm:"index" json:"service"`
	Region     string        `json:"region"`
	ResourceID string        `gorm:"index" json:"resource_id"`
	Tags       JSON          `gorm:"type:jsonb" json:"tags"`
	Amount     float64       `gorm:"not null" json:"amount"`
	Currency   string        `gorm:"default:'USD'" json:"currency"`
	Date       time.Time     `gorm:"type:date;index" json:"date"`
	CreatedAt  time.Time     `json:"created_at"`
}

func (CostRecord) TableName() string {
	return "cost_records"
}
