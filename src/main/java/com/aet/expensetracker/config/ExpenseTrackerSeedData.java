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
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Configuration
public class ExpenseTrackerSeedData {

    // Demo seed: generates a long (100-row) expense ledger so the items list
    // requires scrolling / pagination in the UI. Deterministic (fixed RNG seed)
    // so every fresh database is identical.
    private static final int SEED_COUNT = 100;

    @Bean
    ApplicationRunner seedExpenses(ExpenseRepository expenseRepository, BudgetRepository budgetRepository) {
        return args -> {
            if (expenseRepository.count() == 0) {
                expenseRepository.saveAll(generateExpenses());
            }

            if (budgetRepository.count() == 0) {
                String thisMonth = YearMonth.now().toString();
                budgetRepository.saveAll(List.of(
                        budget(thisMonth, ExpenseCategory.TRAVEL, 120000, 80, "Travel for customer and leadership meetings."),
                        budget(thisMonth, ExpenseCategory.SOFTWARE, 60000, 75, "Recurring product and collaboration software."),
                        budget(thisMonth, ExpenseCategory.MEALS, 40000, 70, "Team meals and client-facing hospitality."),
                        budget(thisMonth, ExpenseCategory.EQUIPMENT, 80000, 85, "Small equipment and peripherals."),
                        budget(thisMonth, ExpenseCategory.OFFICE, 30000, 70, "Office supplies and facilities."),
                        budget(thisMonth, ExpenseCategory.TRAINING, 50000, 60, "Skill upgrades and certifications.")));
            }
        };
    }

    private List<ExpenseEntity> generateExpenses() {
        Random random = new Random(20260611L);

        String[] owners = {
                "Maya Chen", "Vikram Desai", "Rohan Mehta", "Carla Ruiz", "Omar Hassan",
                "Aditi Narang", "Elena Morris", "Ethan Cole", "Priya Patel", "Marcus Thompson"
        };
        ExpenseCategory[] categories = ExpenseCategory.values();
        PaymentMethod[] methods = PaymentMethod.values();
        ExpenseStatus[] statuses = ExpenseStatus.values();

        String[] travel = {"Air India", "IndiGo", "Uber", "Ola Cabs", "Taj Hotels", "OYO Rooms", "IRCTC"};
        String[] software = {"Figma", "JetBrains", "GitHub", "Atlassian", "Notion", "Datadog", "Postman", "Slack"};
        String[] meals = {"Smoke House Deli", "Blue Tokai", "Third Wave Coffee", "Social", "Truffles", "Chai Point"};
        String[] equipment = {"Croma", "Reliance Digital", "Apple Store", "Dell", "Logitech", "Amazon Business"};
        String[] office = {"Staples", "Office Depot", "WeWork", "Urban Ladder", "Pepperfry"};
        String[] client = {"Blue Tokai", "Taj Hotels", "ITC Gardenia", "The Leela", "Hyatt"};
        String[] training = {"Udemy Business", "Coursera", "Pluralsight", "O'Reilly", "edX"};
        String[] other = {"Amazon", "Flipkart", "Razorpay", "Zoho", "BigBasket"};

        String[] descTravel = {"Customer workshop travel", "Onsite sprint travel", "Conference flight", "Airport cab", "Hotel stay for review", "Client visit commute"};
        String[] descSoftware = {"License renewal", "Seat upgrade", "Annual subscription", "Team plan add-on", "API tier upgrade"};
        String[] descMeals = {"Team lunch", "Sprint close dinner", "Client coffee", "Working lunch", "Offsite snacks"};
        String[] descEquipment = {"USB-C dock", "Mechanical keyboard", "External monitor", "Noise-cancel headset", "Laptop stand", "Webcam"};
        String[] descOffice = {"Desk supplies", "Whiteboard markers", "Coworking day pass", "Ergonomic chair", "Stationery restock"};
        String[] descClient = {"Stakeholder dinner", "Roadmap review hosting", "Client onboarding lunch", "Partner sync"};
        String[] descTraining = {"Secure coding course", "Cloud certification", "Frontend masterclass", "Leadership workshop", "QA automation course"};
        String[] descOther = {"Misc reimbursement", "Postage and courier", "Domain renewal", "Team gift", "Pantry restock"};

        List<ExpenseEntity> list = new ArrayList<>(SEED_COUNT);
        for (int i = 0; i < SEED_COUNT; i++) {
            ExpenseCategory category = categories[random.nextInt(categories.length)];
            String merchant;
            String description;
            switch (category) {
                case TRAVEL -> { merchant = pick(random, travel); description = pick(random, descTravel); }
                case SOFTWARE -> { merchant = pick(random, software); description = pick(random, descSoftware); }
                case MEALS -> { merchant = pick(random, meals); description = pick(random, descMeals); }
                case EQUIPMENT -> { merchant = pick(random, equipment); description = pick(random, descEquipment); }
                case OFFICE -> { merchant = pick(random, office); description = pick(random, descOffice); }
                case CLIENT -> { merchant = pick(random, client); description = pick(random, descClient); }
                case TRAINING -> { merchant = pick(random, training); description = pick(random, descTraining); }
                default -> { merchant = pick(random, other); description = pick(random, descOther); }
            }

            double amount = switch (category) {
                case TRAVEL -> 2000 + random.nextInt(28000);
                case EQUIPMENT -> 1500 + random.nextInt(20000);
                case TRAINING -> 1000 + random.nextInt(12000);
                case SOFTWARE -> 800 + random.nextInt(9000);
                default -> 300 + random.nextInt(7000);
            };
            amount = Math.round(amount * 100.0) / 100.0;

            String owner = owners[random.nextInt(owners.length)];
            PaymentMethod method = methods[random.nextInt(methods.length)];
            ExpenseStatus status = statuses[random.nextInt(statuses.length)];
            LocalDate date = LocalDate.now().minusDays(random.nextInt(120));
            boolean reimbursable = method == PaymentMethod.PERSONAL_CARD || method == PaymentMethod.CASH
                    || random.nextInt(3) == 0;
            String note = description + " — " + merchant + " (" + owner.split(" ")[0] + ").";

            list.add(expense(description, merchant, amount, date, category, method, status, owner, reimbursable, note));
        }
        return list;
    }

    private String pick(Random random, String[] values) {
        return values[random.nextInt(values.length)];
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
