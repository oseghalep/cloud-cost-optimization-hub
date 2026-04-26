package models

import (
	"time"

	"github.com/google/uuid"
)

type AlertSeverity string

const (
	AlertSeverityLow      AlertSeverity = "low"
	AlertSeverityMedium   AlertSeverity = "medium"
	AlertSeverityHigh     AlertSeverity = "high"
	AlertSeverityCritical AlertSeverity = "critical"
)

type Alert struct {
	ID           uuid.UUID     `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID       uuid.UUID     `gorm:"type:uuid;not null;index" json:"user_id"`
	Title        string        `gorm:"not null" json:"title"`
	Message      string        `gorm:"not null" json:"message"`
	Severity     AlertSeverity `gorm:"type:varchar(20);default:'medium'" json:"severity"`
	Threshold    float64       `json:"threshold"`
	CurrentValue float64       `json:"current_value,omitempty"`
	IsRead       bool          `gorm:"default:false" json:"is_read"`
	ResolvedAt   *time.Time    `json:"resolved_at,omitempty"`
	CreatedAt    time.Time     `json:"created_at"`
}

func (Alert) TableName() string {
	return "alerts"
}
