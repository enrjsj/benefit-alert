# Render's default Dockerfile path and context are the repository root.
# For a backend-only build context, use backend/Dockerfile instead.
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY backend/pom.xml .
COPY backend/src src
RUN mvn -B package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/benefit-alert-0.1.0.jar app.jar
EXPOSE 8080
USER 10001
ENTRYPOINT ["java","-jar","app.jar"]
