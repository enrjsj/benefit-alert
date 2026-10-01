# 빌드·실행 모두 Java 21로 고정합니다. 비밀 값은 실행 시 주입합니다.
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src src
RUN mvn -B package
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/benefit-alert-0.1.0.jar app.jar
EXPOSE 8080
USER 10001
ENTRYPOINT ["java","-jar","app.jar"]
