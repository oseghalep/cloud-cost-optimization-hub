package postgres

import (
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
	"gorm.io/gorm"
)

type AlertRepository struct {
	db *gorm.DB
}

func NewAlertRepository(db *gorm.DB) *AlertRepository {
	return &AlertRepository{db: db}
}

func (r *AlertRepository) Create(alert *models.Alert) error {
	return r.db.Create(alert).Error
}

func (r *AlertRepository) FindByUserID(userID string) ([]models.Alert, error) {
	var alerts []models.Alert
	err := r.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&alerts).Error
	return alerts, err
}

func (r *AlertRepository) FindUnreadByUserID(userID string) ([]models.Alert, error) {
	var alerts []models.Alert
	err := r.db.Where("user_id = ? AND is_read = ?", userID, false).Order("created_at DESC").Find(&alerts).Error
	return alerts, err
}

func (r *AlertRepository) MarkAsRead(id, userID string) error {
	return r.db.Model(&models.Alert{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_read", true).Error
}

func (r *AlertRepository) MarkAllAsRead(userID string) error {
	return r.db.Model(&models.Alert{}).
		Where("user_id = ?", userID).
		Update("is_read", true).Error
}

func (r *AlertRepository) Delete(id, userID string) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Alert{}).Error
}
