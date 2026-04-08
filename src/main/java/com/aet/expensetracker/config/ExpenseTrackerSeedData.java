package com.aet.expensetracker.config;

import com.aet.expensetracker.domain.BudgetEntity;
import com.aet.expensetracker.domain.ExpenseCategory;
import com.aet.expensetracker.domain.ExpenseEntity;
import com.aet.expensetracker.domain.ExpenseStatus;
import com.aet.expensetracker.domain.PaymentMethod;
import com.aet.expensetracker.repository.BudgetRepository;
import com.aet.expensetracker.repository.ExpenseRepository;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@Configuration
public class ExpenseTrackerSeedData {

    @Bean
    ApplicationRunner seedExpenses(ExpenseRepository expenseRepository, BudgetRepository budgetRepository) {
        return args -> {
            if (expenseRepository.count() == 0) {
                expenseRepository.saveAll(List.of(
                        expense("Customer workshop travel", "Air India", 18450, LocalDate.now().minusDays(2), ExpenseCategory.TRAVEL, PaymentMethod.CORPORATE_CARD, ExpenseStatus.APPROVED, "Maya Chen", true, "Round-trip for Bangalore customer workshop."),
                        expense("Design tool renewal", "Figma", 2499, LocalDate.now().minusDays(5), ExpenseCategory.SOFTWARE, PaymentMethod.CORPORATE_CARD, ExpenseStatus.SUBMITTED, "Vikram Desai", false, "Quarterly license renewal for product squad."),
                        expense("Team dinner", "Smoke House Deli", 6120, LocalDate.now().minusDays(7), ExpenseCategory.MEALS, PaymentMethod.PERSONAL_CARD, ExpenseStatus.REIMBURSED, "Rohan Mehta", true, "Sprint close dinner with the Tiger Team."),
                        expense("USB-C dock", "Croma", 7199, LocalDate.now().minusDays(10), ExpenseCategory.EQUIPMENT, PaymentMethod.CORPORATE_CARD, ExpenseStatus.APPROVED, "Carla Ruiz", false, "Docking setup for release war room."),
                        expense("Security training", "Udemy Business", 3899, LocalDate.now().minusDays(13), ExpenseCategory.TRAINING, PaymentMethod.BANK_TRANSFER, ExpenseStatus.SUBMITTED, "Omar Hassan", false, "Secure coding refresher for the new service rollout."),
                        expense("Client coffee", "Blue Tokai", 1340, LocalDate.now().minusDays(1), ExpenseCategory.CLIENT, PaymentMethod.PERSONAL_CARD, ExpenseStatus.APPROVED, "Aditi Narang", true, "Stakeholder sync before roadmap review.")));
            }

            if (budgetRepository.count() == 0) {
                String thisMonth = YearMonth.now().toString();
                budgetRepository.saveAll(List.of(
                        budget(thisMonth, ExpenseCategory.TRAVEL, 40000, 80, "Travel for customer and leadership meetings."),
                        budget(thisMonth, ExpenseCategory.SOFTWARE, 12000, 75, "Recurring product and collaboration software."),
                        budget(thisMonth, ExpenseCategory.MEALS, 10000, 70, "Team meals and client-facing hospitality."),
                        budget(thisMonth, ExpenseCategory.EQUIPMENT, 20000, 85, "Small equipment and peripherals."),
                        budget(thisMonth, ExpenseCategory.TRAINING, 15000, 60, "Skill upgrades and certifications.")));
            }
        };
    }

    private ExpenseEntity expense(String description,
                                  String merchant,
                                  double amount,
                                  LocalDate date,
                                  ExpenseCategory category,
                                  PaymentMethod paymentMethod,
                                  ExpenseStatus status,
                                  String owner,
                                  boolean reimbursable,
                                  String note) {
        ExpenseEntity entity = new ExpenseEntity();
        entity.setDescription(description);
        entity.setMerchant(merchant);
        entity.setAmount(BigDecimal.valueOf(amount));
        entity.setExpenseDate(date);
        entity.setCategory(category);
        entity.setPaymentMethod(paymentMethod);
        entity.setStatus(status);
        entity.setOwnerName(owner);
        entity.setReimbursable(reimbursable);
        entity.setNote(note);
        return entity;
    }

    private BudgetEntity budget(String month, ExpenseCategory category, double limitAmount, int threshold, String notes) {
        BudgetEntity entity = new BudgetEntity();
        entity.setBudgetMonth(month);
        entity.setCategory(category);
        entity.setLimitAmount(BigDecimal.valueOf(limitAmount));
        entity.setAlertThresholdPercent(threshold);
        entity.setNotes(notes);
        return entity;
    }
}
