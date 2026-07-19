package postgres

import (
	"time"

	"github.com/google/uuid"
	"github.com/oseghalep/cloud-cost-optimization-hub/backend/internal/models"
	"gorm.io/gorm"
)

type CostRepository struct {
	db *gorm.DB
}

func NewCostRepository(db *gorm.DB) *CostRepository {
	return &CostRepository{db: db}
}

func (r *CostRepository) Create(record *models.CostRecord) error {
	return r.db.Create(record).Error
}

func (r *CostRepository) BulkCreate(records []models.CostRecord) error {
	return r.db.CreateInBatches(records, 100).Error
}

// ReplaceAccountRange swaps an account's cost records for a date window in one
// transaction: delete what's there, insert the fresh set.
//
// Syncs are user-triggerable and re-fetch the same rolling window every time.
// CostRecord has no unique constraint, so a plain insert would append a
// duplicate copy of the window on every sync and inflate every total.
func (r *CostRepository) ReplaceAccountRange(
	accountID uuid.UUID,
	startDate, endDate time.Time,
	records []models.CostRecord,
) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("account_id = ? AND date BETWEEN ? AND ?", accountID, startDate, endDate).
			Delete(&models.CostRecord{}).Error; err != nil {
			return err
		}
		if len(records) == 0 {
			return nil
		}
		return tx.CreateInBatches(records, 100).Error
	})
}

func (r *CostRepository) GetCostsByAccount(accountID, userID string, startDate, endDate time.Time) ([]models.CostRecord, error) {
	var costs []models.CostRecord
	err := r.db.
		Joins("JOIN cloud_accounts ON cloud_accounts.id = cost_records.account_id").
		Where("cost_records.account_id = ? AND cloud_accounts.user_id = ? AND cost_records.date BETWEEN ? AND ?",
			accountID, userID, startDate, endDate).
		Order("cost_records.date ASC").
		Find(&costs).Error
	return costs, err
}

func (r *CostRepository) GetTotalCost(userID string, startDate, endDate time.Time) (float64, error) {
	var total float64
	err := r.db.
		Table("cost_records").
		Joins("JOIN cloud_accounts ON cloud_accounts.id = cost_records.account_id").
		Where("cloud_accounts.user_id = ? AND cost_records.date BETWEEN ? AND ?", userID, startDate, endDate).
		Select("COALESCE(SUM(cost_records.amount), 0)").
		Scan(&total).Error
	return total, err
}

func (r *CostRepository) GetCostByService(userID string, startDate, endDate time.Time) (map[string]float64, error) {
	type Result struct {
		Service string
		Total   float64
	}

	var results []Result
	err := r.db.
		Table("cost_records").
		Joins("JOIN cloud_accounts ON cloud_accounts.id = cost_records.account_id").
		Where("cloud_accounts.user_id = ? AND cost_records.date BETWEEN ? AND ?", userID, startDate, endDate).
		Select("cost_records.service, SUM(cost_records.amount) as total").
		Group("cost_records.service").
		Scan(&results).Error

	if err != nil {
		return nil, err
	}

	costByService := make(map[string]float64)
	for _, r := range results {
		costByService[r.Service] = r.Total
	}
	return costByService, nil
}
