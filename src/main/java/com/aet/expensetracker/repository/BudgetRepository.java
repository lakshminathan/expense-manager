package com.aet.expensetracker.repository;

import com.aet.expensetracker.domain.BudgetEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BudgetRepository extends JpaRepository<BudgetEntity, Long> {

    List<BudgetEntity> findAllByOrderByBudgetMonthDescCategoryAsc();

    Optional<BudgetEntity> findByBudgetMonthAndCategory(String budgetMonth, com.aet.expensetracker.domain.ExpenseCategory category);
}
