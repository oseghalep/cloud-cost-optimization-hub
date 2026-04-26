package postgres

import (
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
	"gorm.io/gorm"
)

type RecommendationRepository struct {
	db *gorm.DB
}

func NewRecommendationRepository(db *gorm.DB) *RecommendationRepository {
	return &RecommendationRepository{db: db}
}

func (r *RecommendationRepository) Create(rec *models.Recommendation) error {
	return r.db.Create(rec).Error
}

func (r *RecommendationRepository) BulkCreate(recs []models.Recommendation) error {
	return r.db.CreateInBatches(recs, 100).Error
}

func (r *RecommendationRepository) FindByAccountID(accountID, userID string) ([]models.Recommendation, error) {
	var recommendations []models.Recommendation
	err := r.db.
		Joins("JOIN cloud_accounts ON cloud_accounts.id = recommendations.account_id").
		Where("recommendations.account_id = ? AND cloud_accounts.user_id = ?", accountID, userID).
		Order("recommendations.potential_savings DESC").
		Find(&recommendations).Error
	return recommendations, err
}

func (r *RecommendationRepository) FindAllByUserID(userID string) ([]models.Recommendation, error) {
	var recommendations []models.Recommendation
	err := r.db.
		Joins("JOIN cloud_accounts ON cloud_accounts.id = recommendations.account_id").
		Where("cloud_accounts.user_id = ? AND recommendations.status = ?", userID, models.RecommendationStatusPending).
		Order("recommendations.potential_savings DESC").
		Find(&recommendations).Error
	return recommendations, err
}

func (r *RecommendationRepository) UpdateStatus(id string, status models.RecommendationStatus) error {
	return r.db.Model(&models.Recommendation{}).
		Where("id = ?", id).
		Update("status", status).Error
}

func (r *RecommendationRepository) DeleteByAccountID(accountID string) error {
	return r.db.Where("account_id = ?", accountID).Delete(&models.Recommendation{}).Error
}
