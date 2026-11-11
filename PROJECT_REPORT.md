# AWS DevOps Microservices CI/CD Automation

## 1. Project Overview

This project demonstrates the deployment and automation of a Node.js microservices application using AWS, Docker, Jenkins, Terraform, Amazon ECR, Prometheus, and Grafana.

The application consists of four components:

- API Gateway
- User Service
- Product Service
- Order Service

Three PostgreSQL databases provide persistent storage for the individual microservices.

## 2. AWS Infrastructure

Infrastructure was provisioned using Terraform in the AWS Mumbai region (`ap-south-1`).

**AWS Resources:**
- EC2 Ubuntu Server
- Security Group
- IAM Role and Instance Profile
- Three Amazon ECR Repositories
- SSH Key Pair

## 3. CI/CD Pipeline

The Jenkins pipeline implements the following workflow:

GitHub → Jenkins → Docker Build → Amazon ECR → EC2 Deployment → Health Check

**Pipeline Stages:**

1. Checkout source code from GitHub.
2. Verify Docker and AWS access.
3. Build Docker images for all four application components.
4. Push User, Product, and Order Service images to Amazon ECR.
5. Verify ECR images.
6. Deploy updated microservices on EC2 using Docker Compose.
7. Verify application health.
8. Attempt rollback to the previous release if deployment validation fails.

The pipeline is maintained in the GitHub repository's `Jenkinsfile` and can be executed through Jenkins.

## 4. Docker Deployment

The application uses Docker Compose with seven containers:

- API Gateway
- User Service
- Product Service
- Order Service
- User PostgreSQL Database
- Product PostgreSQL Database
- Order PostgreSQL Database

The three microservices use versioned images stored in Amazon ECR.

## 5. Nginx Reverse Proxy

Nginx forwards application requests to the API Gateway.

**Application health endpoint:**

`http://<EC2-PUBLIC-IP>/health`

The endpoint provides health information for the API Gateway and dependent microservices.

## 6. Monitoring

Prometheus collects application and infrastructure metrics.

**Monitoring Components:**
- Prometheus
- Grafana
- Node Exporter

**Prometheus Targets:**
- API Gateway
- User Service
- Product Service
- Order Service
- Prometheus
- EC2 Node Exporter

All six targets were verified as operational.

**Grafana Dashboards:**
- AWS Microservices Monitoring Dashboard
- Node Exporter Full Dashboard

Monitoring includes service availability, application CPU and memory metrics, and EC2 CPU, RAM, disk, and network metrics.

## 7. Deployment Verification

Final verification completed on November 11, 2026.

**Results:**
- Seven application and database containers healthy.
- Three monitoring containers running.
- Application health endpoint returned HTTP 200.
- User Service health check passed.
- Product Service health check passed.
- Order Service health check passed.
- Jenkins CI/CD pipeline executed successfully.

## 8. Security and Operational Considerations

- Jenkins, Grafana, Prometheus, and Node Exporter interfaces use localhost access.
- SSH tunneling provides private browser access to management interfaces.
- Database credentials are stored in a local `.env` file and are excluded from Git.
- Docker volumes provide database persistence.
- The Jenkins pipeline includes rollback logic, although failure simulation and rollback validation should be documented separately.
- Dependency vulnerabilities reported during Docker builds require review before production use.
- GitHub changes are currently built using Jenkins job execution; automatic push-triggered builds require an additional trigger configuration.

## 9. Conclusion

The project demonstrates an AWS-based microservices deployment with infrastructure provisioning, containerization, versioned container images, Jenkins CI/CD automation, deployment health checks, and centralized monitoring.

The application and monitoring services were verified as running successfully.
