package com.aet.expensetracker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ExpenseTrackerApplication {

    public static void main(String[] args) {
        System.out.println("Tiger Team automation active");
        SpringApplication.run(ExpenseTrackerApplication.class, args);
    }
}
