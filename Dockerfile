FROM gcr.io/distroless/java21-debian12:nonroot
WORKDIR /app
COPY target/expense-tracker-1.0.0-SNAPSHOT.jar app.jar
EXPOSE 8086
ENTRYPOINT ["java", "-jar", "app.jar"]
