package postgres

import (
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
	"gorm.io/gorm"
)

type CloudAccountRepository struct {
	db *gorm.DB
}

func NewCloudAccountRepository(db *gorm.DB) *CloudAccountRepository {
	return &CloudAccountRepository{db: db}
}

func (r *CloudAccountRepository) Create(account *models.CloudAccount) error {
	return r.db.Create(account).Error
}

func (r *CloudAccountRepository) FindByID(id, userID string) (*models.CloudAccount, error) {
	var account models.CloudAccount
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&account).Error
	return &account, err
}

func (r *CloudAccountRepository) FindAllByUserID(userID string) ([]models.CloudAccount, error) {
	var accounts []models.CloudAccount
	err := r.db.Where("user_id = ?", userID).Find(&accounts).Error
	return accounts, err
}

func (r *CloudAccountRepository) Update(account *models.CloudAccount) error {
	return r.db.Save(account).Error
}

func (r *CloudAccountRepository) Delete(id, userID string) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.CloudAccount{}).Error
}

// UpdateStatus writes only the status column. Using this instead of Update()
// avoids Save() writing a stale in-memory last_sync_at back over the fresh
// timestamp that UpdateLastSync just set during a sync.
// Scoped by user_id so the repository enforces ownership itself rather than
// trusting every caller to have already checked.
func (r *CloudAccountRepository) UpdateStatus(id, userID, status string) error {
	return r.db.Model(&models.CloudAccount{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("status", status).Error
}

func (r *CloudAccountRepository) UpdateLastSync(id string) error {
	return r.db.Model(&models.CloudAccount{}).
		Where("id = ?", id).
		Update("last_sync_at", gorm.Expr("NOW()")).Error
}
