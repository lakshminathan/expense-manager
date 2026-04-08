package com.aet.expensetracker.controller;

import com.aet.expensetracker.domain.ExpenseCategory;
import com.aet.expensetracker.domain.ExpenseStatus;
import com.aet.expensetracker.domain.PaymentMethod;
import com.aet.expensetracker.service.ExpenseTrackerService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/expense-tracker")
@CrossOrigin(origins = "*")
public class ExpenseTrackerController {

    private final ExpenseTrackerService expenseTrackerService;

    public ExpenseTrackerController(ExpenseTrackerService expenseTrackerService) {
        this.expenseTrackerService = expenseTrackerService;
    }

    @GetMapping("/expenses")
    public List<ExpenseResponse> listExpenses(
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String query) {
        return expenseTrackerService.listExpenses(month, category, query);
    }

    @PostMapping("/expenses")
    public ResponseEntity<ExpenseResponse> createExpense(@Valid @RequestBody ExpenseRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(expenseTrackerService.createExpense(request));
    }

    @PutMapping("/expenses/{expenseId}")
    public ExpenseResponse updateExpense(@PathVariable Long expenseId, @Valid @RequestBody ExpenseRequest request) {
        return expenseTrackerService.updateExpense(expenseId, request);
    }

    @DeleteMapping("/expenses/{expenseId}")
    public ResponseEntity<Void> deleteExpense(@PathVariable Long expenseId) {
        expenseTrackerService.deleteExpense(expenseId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/budgets")
    public List<BudgetResponse> listBudgets(@RequestParam(required = false) String month) {
        return expenseTrackerService.listBudgets(month);
    }

    @PostMapping("/budgets")
    public ResponseEntity<BudgetResponse> upsertBudget(@Valid @RequestBody BudgetRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(expenseTrackerService.upsertBudget(request));
    }

    @GetMapping("/summary")
    public SummaryResponse summary(@RequestParam(required = false) String month) {
        return expenseTrackerService.summary(month);
    }

    @GetMapping("/metadata")
    public MetadataResponse metadata() {
        return expenseTrackerService.metadata();
    }

    public record ExpenseRequest(
            @NotBlank String description,
            @NotBlank String merchant,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotNull LocalDate expenseDate,
            @NotNull ExpenseCategory category,
            @NotNull PaymentMethod paymentMethod,
            @NotNull ExpenseStatus status,
            @NotBlank String ownerName,
            String note,
            String receiptUrl,
            boolean reimbursable) {
    }

    public record ExpenseResponse(
            Long id,
            String description,
            String merchant,
            BigDecimal amount,
            LocalDate expenseDate,
            ExpenseCategory category,
            PaymentMethod paymentMethod,
            ExpenseStatus status,
            String ownerName,
            String note,
            String receiptUrl,
            boolean reimbursable,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record BudgetRequest(
            @NotBlank String budgetMonth,
            @NotNull ExpenseCategory category,
            @NotNull @DecimalMin("1.00") BigDecimal limitAmount,
            @NotNull @Min(1) @Max(100) Integer alertThresholdPercent,
            String notes) {
    }

    public record BudgetResponse(
            Long id,
            String budgetMonth,
            ExpenseCategory category,
            BigDecimal limitAmount,
            Integer alertThresholdPercent,
            String notes,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record SummaryResponse(
            String month,
            BigDecimal totalSpent,
            BigDecimal reimbursableTotal,
            BigDecimal approvedTotal,
            BigDecimal budgetedTotal,
            BigDecimal budgetConsumptionPercent,
            int expenseCount,
            List<CategorySpend> categoryBreakdown) {
    }

    public record CategorySpend(
            ExpenseCategory category,
            BigDecimal amount) {
    }

    public record MetadataResponse(
            List<ExpenseCategory> categories,
            List<PaymentMethod> paymentMethods,
            List<ExpenseStatus> statuses) {
    }
}
