pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timestamps()
    }

    stages {

        stage('GitHub Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/preethanazreen1037/aws-devops-microservices-project.git'
            }
        }

        stage('Verify Environment') {
            steps {
                sh '''
                    set -e
                    docker info > /dev/null
                    aws sts get-caller-identity
                    echo "Environment Verification SUCCESS"
                '''
            }
        }

        stage('Build Docker Images') {
            steps {
                sh '''
                    set -e

                    for service in user product order; do
                        docker build \
                          -f services/${service}-service/Dockerfile \
                          -t microservices-${service}-ci:${BUILD_NUMBER} .
                    done

                    docker build \
                      -f services/api-gateway/Dockerfile \
                      -t microservices-gateway-ci:${BUILD_NUMBER} .

                    echo "ALL DOCKER IMAGES BUILD SUCCESS"
                '''
            }
        }

        stage('Push Images to Amazon ECR') {
            steps {
                sh '''#!/bin/bash
                    set -euo pipefail

                    REGION="ap-south-1"

                    ACCOUNT_ID=$(aws sts get-caller-identity \
                        --query Account --output text)

                    REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

                    VERSION="ci-${BUILD_NUMBER}-$(git rev-parse --short=8 HEAD)"

                    export DOCKER_CONFIG
                    DOCKER_CONFIG=$(mktemp -d)
                    trap 'rm -rf "$DOCKER_CONFIG"' EXIT

                    echo "Logging into Amazon ECR"

                    aws ecr get-login-password \
                        --region "$REGION" | \
                        docker login \
                        --username AWS \
                        --password-stdin "$REGISTRY"

                    for service in user product order; do

                        SOURCE="microservices-${service}-ci:${BUILD_NUMBER}"

                        TARGET="${REGISTRY}/microservices-task/${service}-service:${VERSION}"

                        echo "Pushing ${service}-service"

                        docker tag "$SOURCE" "$TARGET"

                        docker push "$TARGET"

                        echo "${service}-service pushed successfully"

                    done

                    echo "ALL ECR IMAGES PUSHED SUCCESSFULLY"
                    echo "Release version: ${VERSION}"
                '''
            }
        }

        stage('Verify ECR Images') {
            steps {
                sh '''
                    set -e

                    for service in user product order; do

                        aws ecr describe-images \
                          --repository-name microservices-task/${service}-service \
                          --region ap-south-1 \
                          --query 'length(imageDetails)' \
                          --output text

                    done

                    echo "ECR VERIFICATION SUCCESS"
                '''
            }
        }
    
                stage('Automated EC2 Deployment') {
            steps {
                sh '''#!/bin/bash
                    set -euo pipefail

                    DEPLOY_DIR="/home/ubuntu/aws-devops-microservices-project"
                    REGION="ap-south-1"
                    REGISTRY="359290219051.dkr.ecr.ap-south-1.amazonaws.com"

                    NEW_TAG="ci-${BUILD_NUMBER}-$(git rev-parse --short=8 HEAD)"

                    echo "===== AUTOMATED DEPLOYMENT STARTED ====="
                    echo "New Release: $NEW_TAG"

                    cd "$DEPLOY_DIR"

                    export ECR_TAG="$NEW_TAG"

                    COMPOSE=(
                        docker compose
                        -f docker-compose.yml
                        -f docker-compose.ecr.yml
                    )

                    echo "===== CHECKING PREVIOUS RELEASE ====="

                    OLD_TAG=""

                    for service in user product order; do
                        CID=$("${COMPOSE[@]}" ps -q "${service}-service")

                        if [ -z "$CID" ]; then
                            echo "ERROR: ${service}-service container not found"
                            exit 1
                        fi

                        IMAGE=$(docker inspect \
                            --format '{{.Config.Image}}' "$CID")

                        PREFIX="${REGISTRY}/microservices-task/${service}-service:"

                        if [[ "$IMAGE" != "$PREFIX"* ]]; then
                            echo "ERROR: Unexpected previous image for $service"
                            exit 1
                        fi

                        CURRENT_TAG="${IMAGE#"$PREFIX"}"

                        if [ -z "$OLD_TAG" ]; then
                            OLD_TAG="$CURRENT_TAG"
                        elif [ "$OLD_TAG" != "$CURRENT_TAG" ]; then
                            echo "ERROR: Previous service tags do not match"
                            exit 1
                        fi
                    done

                    echo "Previous Release: $OLD_TAG"

                    echo "===== ECR LOGIN ====="

                    AUTH_DIR=$(mktemp -d)
                    export DOCKER_CONFIG="$AUTH_DIR"
                    trap 'rm -rf "$AUTH_DIR"' EXIT

                    aws ecr get-login-password \
                        --region "$REGION" |
                        docker login \
                            --username AWS \
                            --password-stdin "$REGISTRY"

                    echo "===== PULLING LATEST IMAGES ====="

                    "${COMPOSE[@]}" pull \
                        user-service \
                        product-service \
                        order-service

                    check_health() {
                        for attempt in $(seq 1 12); do
                            if curl -fsS --max-time 5 \
                                http://127.0.0.1/health |
                                python3 -c '
import json
import sys

data = json.load(sys.stdin)

assert data.get("status") == "healthy"
assert all(
    data.get("checks", {}).get(s) is True
    for s in ("user", "product", "order")
)

print("ALL_SERVICES_HEALTHY")
'
                            then
                                return 0
                            fi

                            sleep 5
                        done

                        return 1
                    }

                    echo "===== DEPLOYING NEW RELEASE ====="

                    if "${COMPOSE[@]}" up -d \
                        --no-deps \
                        --no-build \
                        --pull never \
                        --wait \
                        --wait-timeout 180 \
                        user-service \
                        product-service \
                        order-service &&
                        check_health
                    then
                        echo "AUTOMATED_DEPLOYMENT_SUCCESS"
                        echo "Deployed Version: $NEW_TAG"
                    else
                        echo "===== DEPLOYMENT FAILED ====="
                        echo "===== ROLLING BACK ====="

                        export ECR_TAG="$OLD_TAG"

                        if "${COMPOSE[@]}" up -d \
                            --no-deps \
                            --no-build \
                            --pull never \
                            --wait \
                            --wait-timeout 180 \
                            user-service \
                            product-service \
                            order-service &&
                            check_health
                        then
                            echo "ROLLBACK_COMPLETED"
                        else
                            echo "ROLLBACK_FAILED: Manual recovery required"
                        fi

                        exit 1
                    fi
                '''
            }
        }
    }

    post {
        success {
            echo 'JENKINS CI/CD BUILD AND ECR PUSH SUCCESSFUL'
        }

        failure {
            echo 'JENKINS CI/CD PIPELINE FAILED'
        }
    }
}
