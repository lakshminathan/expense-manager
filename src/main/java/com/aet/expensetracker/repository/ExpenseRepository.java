package com.aet.expensetracker.repository;

import com.aet.expensetracker.domain.ExpenseEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExpenseRepository extends JpaRepository<ExpenseEntity, Long> {

    List<ExpenseEntity> findAllByOrderByExpenseDateDescIdDesc();
}
