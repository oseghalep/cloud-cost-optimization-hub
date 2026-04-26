package models

import (
	"time"

	"github.com/google/uuid"
)

type RecommendationType string

const (
	RecommendationRightsizing RecommendationType = "rightsizing"
	RecommendationOrphaned    RecommendationType = "orphaned"
	RecommendationReserved    RecommendationType = "reserved_instance"
)

type RecommendationStatus string

const (
	RecommendationStatusPending   RecommendationStatus = "pending"
	RecommendationStatusDismissed RecommendationStatus = "dismissed"
	RecommendationStatusApplied   RecommendationStatus = "applied"
)

type Recommendation struct {
	ID               uuid.UUID            `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	AccountID        uuid.UUID            `gorm:"type:uuid;not null;index" json:"account_id"`
	Type             RecommendationType   `gorm:"type:varchar(50);not null" json:"type"`
	Title            string               `gorm:"not null" json:"title"`
	Description      string               `gorm:"not null" json:"description"`
	ResourceID       string               `gorm:"index" json:"resource_id"`
	ResourceType     string               `json:"resource_type"`
	CurrentValue     float64              `json:"current_value"`
	SuggestedValue   float64              `json:"suggested_value"`
	PotentialSavings float64              `json:"potential_savings"`
	Currency         string               `gorm:"default:'USD'" json:"currency"`
	Status           RecommendationStatus `gorm:"default:'pending'" json:"status"`
	Metadata         JSON                 `gorm:"type:jsonb" json:"metadata"`
	CreatedAt        time.Time            `json:"created_at"`
	UpdatedAt        time.Time            `json:"updated_at"`
}

func (Recommendation) TableName() string {
	return "recommendations"
}
