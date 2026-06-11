package com.aet.expensetracker.service;

import com.aet.expensetracker.controller.ExpenseTrackerController.BudgetRequest;
import com.aet.expensetracker.controller.ExpenseTrackerController.BudgetResponse;
import com.aet.expensetracker.controller.ExpenseTrackerController.CategorySpend;
import com.aet.expensetracker.controller.ExpenseTrackerController.ExpenseRequest;
import com.aet.expensetracker.controller.ExpenseTrackerController.ExpenseResponse;
import com.aet.expensetracker.controller.ExpenseTrackerController.MetadataResponse;
import com.aet.expensetracker.controller.ExpenseTrackerController.SummaryResponse;
import com.aet.expensetracker.domain.BudgetEntity;
import com.aet.expensetracker.domain.ExpenseCategory;
import com.aet.expensetracker.domain.ExpenseEntity;
import com.aet.expensetracker.domain.ExpenseStatus;
import com.aet.expensetracker.repository.BudgetRepository;
import com.aet.expensetracker.repository.ExpenseRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@Transactional
public class ExpenseTrackerService {

    private final ExpenseRepository expenseRepository;
    private final BudgetRepository budgetRepository;

    public ExpenseTrackerService(ExpenseRepository expenseRepository, BudgetRepository budgetRepository) {
        this.expenseRepository = expenseRepository;
        this.budgetRepository = budgetRepository;
    }

    @Transactional(readOnly = true)
    public List<ExpenseResponse> listExpenses(String month, String category, String query) {
        YearMonth yearMonth = parseMonth(month);
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase();
        ExpenseCategory categoryFilter = parseCategory(category);

        return expenseRepository.findAllByOrderByExpenseDateDescIdDesc().stream()
                .filter(expense -> yearMonth == null || YearMonth.from(expense.getExpenseDate()).equals(yearMonth))
                .filter(expense -> categoryFilter == null || expense.getCategory() == categoryFilter)
                .filter(expense -> normalizedQuery.isBlank() || matchesQuery(expense, normalizedQuery))
                .map(this::toExpenseResponse)
                .toList();
    }

    public ExpenseResponse createExpense(ExpenseRequest request) {
        ExpenseEntity entity = new ExpenseEntity();
        applyExpenseRequest(entity, request);
        return toExpenseResponse(expenseRepository.save(entity));
    }

    public ExpenseResponse updateExpense(Long expenseId, ExpenseRequest request) {
        ExpenseEntity entity = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new EntityNotFoundException("Expense not found: " + expenseId));
        applyExpenseRequest(entity, request);
        return toExpenseResponse(expenseRepository.save(entity));
    }

    public void deleteExpense(Long expenseId) {
        if (!expenseRepository.existsById(expenseId)) {
            throw new EntityNotFoundException("Expense not found: " + expenseId);
        }
        expenseRepository.deleteById(expenseId);
    }

    @Transactional(readOnly = true)
    public List<BudgetResponse> listBudgets(String month) {
        YearMonth yearMonth = parseMonth(month);
        return budgetRepository.findAllByOrderByBudgetMonthDescCategoryAsc().stream()
                .filter(budget -> yearMonth == null || budget.getBudgetMonth().equals(yearMonth.toString()))
                .map(this::toBudgetResponse)
                .toList();
    }

    public BudgetResponse upsertBudget(BudgetRequest request) {
        String budgetMonth = parseMonth(request.budgetMonth()).toString();
        BudgetEntity entity = budgetRepository.findByBudgetMonthAndCategory(budgetMonth, request.category())
                .orElseGet(BudgetEntity::new);
        entity.setBudgetMonth(budgetMonth);
        entity.setCategory(request.category());
        entity.setLimitAmount(request.limitAmount().setScale(2, RoundingMode.HALF_UP));
        entity.setAlertThresholdPercent(request.alertThresholdPercent());
        entity.setNotes(blankToNull(request.notes()));
        return toBudgetResponse(budgetRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public SummaryResponse summary(String month) {
        YearMonth requestedMonth = parseMonth(month);
        YearMonth yearMonth = requestedMonth == null ? YearMonth.now() : requestedMonth;

        List<ExpenseEntity> expenses = expenseRepository.findAllByOrderByExpenseDateDescIdDesc().stream()
                .filter(expense -> YearMonth.from(expense.getExpenseDate()).equals(yearMonth))
                .toList();
        List<BudgetEntity> budgets = budgetRepository.findAllByOrderByBudgetMonthDescCategoryAsc().stream()
                .filter(budget -> budget.getBudgetMonth().equals(yearMonth.toString()))
                .toList();

        BigDecimal totalSpent = sum(expenses.stream().map(ExpenseEntity::getAmount).toList());
        BigDecimal reimbursable = sum(expenses.stream().filter(ExpenseEntity::isReimbursable).map(ExpenseEntity::getAmount).toList());
        BigDecimal approved = sum(expenses.stream().filter(expense -> expense.getStatus() == ExpenseStatus.APPROVED || expense.getStatus() == ExpenseStatus.REIMBURSED).map(ExpenseEntity::getAmount).toList());
        BigDecimal budgeted = sum(budgets.stream().map(BudgetEntity::getLimitAmount).toList());

        List<CategorySpend> categoryBreakdown = expenses.stream()
                .collect(Collectors.groupingBy(ExpenseEntity::getCategory,
                        Collectors.mapping(ExpenseEntity::getAmount, Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))))
                .entrySet().stream()
                .map(entry -> new CategorySpend(entry.getKey(), scale(entry.getValue())))
                .sorted(Comparator.comparing(CategorySpend::amount).reversed())
                .toList();

        return new SummaryResponse(
                yearMonth.toString(),
                scale(totalSpent),
                scale(reimbursable),
                scale(approved),
                scale(budgeted),
                budgeted.compareTo(BigDecimal.ZERO) > 0 ? scale(totalSpent.multiply(BigDecimal.valueOf(100)).divide(budgeted, 2, RoundingMode.HALF_UP)) : BigDecimal.ZERO,
                expenses.size(),
                categoryBreakdown);
    }

    @Transactional(readOnly = true)
    public MetadataResponse metadata() {
        return new MetadataResponse(
                List.of(ExpenseCategory.values()),
                List.of(com.aet.expensetracker.domain.PaymentMethod.values()),
                List.of(ExpenseStatus.values()));
    }

    private void applyExpenseRequest(ExpenseEntity entity, ExpenseRequest request) {
        entity.setDescription(request.description().trim());
        entity.setMerchant(request.merchant().trim());
        entity.setAmount(request.amount().setScale(2, RoundingMode.HALF_UP));
        entity.setExpenseDate(request.expenseDate());
        entity.setCategory(request.category());
        entity.setPaymentMethod(request.paymentMethod());
        entity.setStatus(request.status());
        entity.setOwnerName(request.ownerName().trim());
        entity.setNote(blankToNull(request.note()));
        entity.setReceiptUrl(blankToNull(request.receiptUrl()));
        entity.setReimbursable(request.reimbursable());
    }

    private ExpenseResponse toExpenseResponse(ExpenseEntity entity) {
        return new ExpenseResponse(
                entity.getId(),
                entity.getDescription(),
                entity.getMerchant(),
                scale(entity.getAmount()),
                entity.getExpenseDate(),
                entity.getCategory(),
                entity.getPaymentMethod(),
                entity.getStatus(),
                entity.getOwnerName(),
                entity.getNote(),
                entity.getReceiptUrl(),
                entity.isReimbursable(),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }

    private BudgetResponse toBudgetResponse(BudgetEntity entity) {
        return new BudgetResponse(
                entity.getId(),
                entity.getBudgetMonth(),
                entity.getCategory(),
                scale(entity.getLimitAmount()),
                entity.getAlertThresholdPercent(),
                entity.getNotes(),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }

    private boolean matchesQuery(ExpenseEntity expense, String query) {
        return List.of(expense.getDescription(), expense.getMerchant(), expense.getOwnerName(), expense.getNote(), expense.getCategory().name())
                .stream()
                .filter(Objects::nonNull)
                .map(String::toLowerCase)
                .anyMatch(value -> value.contains(query));
    }

    private ExpenseCategory parseCategory(String category) {
        if (category == null || category.isBlank()) {
            return null;
        }
        return ExpenseCategory.valueOf(category.trim().toUpperCase());
    }

    private YearMonth parseMonth(String month) {
        if (month == null || month.isBlank()) {
            return null;
        }
        return YearMonth.parse(month.trim());
    }

    private BigDecimal sum(List<BigDecimal> values) {
        return scale(values.stream().reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private BigDecimal scale(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
