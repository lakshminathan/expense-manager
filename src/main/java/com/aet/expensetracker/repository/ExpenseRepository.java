package com.aet.expensetracker.repository;

import com.aet.expensetracker.domain.ExpenseCategory;
import com.aet.expensetracker.domain.ExpenseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ExpenseRepository extends JpaRepository<ExpenseEntity, Long> {

    List<ExpenseEntity> findAllByOrderByExpenseDateDescIdDesc();

    @Query("SELECT e FROM ExpenseEntity e " +
            "WHERE (:monthStart IS NULL OR e.expenseDate >= :monthStart) " +
            "AND (:monthEnd IS NULL OR e.expenseDate <= :monthEnd) " +
            "AND (:categoryFilter IS NULL OR e.category = :categoryFilter) " +
            "AND (:searchQuery IS NULL OR " +
            "   LOWER(e.description) LIKE %:searchQuery% OR " +
            "   LOWER(e.merchant) LIKE %:searchQuery% OR " +
            "   LOWER(e.ownerName) LIKE %:searchQuery% OR " +
            "   LOWER(e.note) LIKE %:searchQuery% OR " +
            "   LOWER(e.category.name) LIKE %:searchQuery%) " +
            "ORDER BY e.expenseDate DESC, e.id DESC")
    Page<ExpenseEntity> findFilteredExpenses(
            @Param("monthStart") LocalDate monthStart,
            @Param("monthEnd") LocalDate monthEnd,
            @Param("categoryFilter") ExpenseCategory categoryFilter,
            @Param("searchQuery") String searchQuery,
            Pageable pageable);
}
