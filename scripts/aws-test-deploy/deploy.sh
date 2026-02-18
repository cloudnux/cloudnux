#!/usr/bin/env bash
set -euo pipefail

#
# CloudNux AWS Test Deployment Script
# Deploys the identity module as a Lambda with HTTP API Gateway + WebSocket API Gateway
#
# Usage:
#   ./deploy.sh deploy --profile <aws-profile> [--region <region>] [--stage <stage>]
#   ./deploy.sh destroy --profile <aws-profile> [--region <region>] [--stage <stage>]
#

# Disable AWS CLI pager (prevents opening less/vim)
export AWS_PAGER=""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
EXAMPLE_DIR="$ROOT_DIR/example"
MODULE_NAME="identity"
STACK_PREFIX="cloudnux-test"
STAGE="dev"
REGION=""
PROFILE=""
ACTION=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }
info()  { echo -e "${CYAN}[i]${NC} $1"; }

usage() {
    echo "Usage: $0 <deploy|destroy> --profile <aws-profile> [--region <region>] [--stage <stage>]"
    echo ""
    echo "Commands:"
    echo "  deploy   - Package and deploy the identity module to AWS (run 'yarn build' first)"
    echo "  destroy  - Tear down all deployed AWS resources"
    echo ""
    echo "Options:"
    echo "  --profile  AWS CLI profile name (required)"
    echo "  --region   AWS region (default: profile default region)"
    echo "  --stage    Deployment stage name (default: dev)"
    exit 1
}

# Parse arguments
[[ $# -lt 1 ]] && usage
ACTION="$1"; shift

while [[ $# -gt 0 ]]; do
    case "$1" in
        --profile) PROFILE="$2"; shift 2 ;;
        --region)  REGION="$2"; shift 2 ;;
        --stage)   STAGE="$2"; shift 2 ;;
        *)         error "Unknown option: $1" ;;
    esac
done

[[ -z "$PROFILE" ]] && error "--profile is required"
[[ "$ACTION" != "deploy" && "$ACTION" != "destroy" ]] && usage

# Set AWS CLI base command
AWS="aws --profile $PROFILE"
[[ -n "$REGION" ]] && AWS="$AWS --region $REGION"

# Resolve region
if [[ -z "$REGION" ]]; then
    REGION=$($AWS configure get region 2>/dev/null || echo "")
    [[ -z "$REGION" ]] && error "No region specified and none configured for profile '$PROFILE'"
fi

FUNCTION_NAME="${STACK_PREFIX}-identity-${STAGE}"
ROLE_NAME="${STACK_PREFIX}-lambda-role-${STAGE}"
HTTP_API_NAME="${STACK_PREFIX}-http-api-${STAGE}"
WS_API_NAME="${STACK_PREFIX}-ws-api-${STAGE}"
ACCOUNT_ID=$($AWS sts get-caller-identity --query Account --output text)

info "Account: $ACCOUNT_ID | Region: $REGION | Stage: $STAGE | Profile: $PROFILE"

# ─── STATE FILE ───────────────────────────────────────────────
STATE_FILE="$SCRIPT_DIR/.deploy-state-${STAGE}.json"

save_state() {
    cat > "$STATE_FILE" <<EOF
{
    "functionName": "$FUNCTION_NAME",
    "roleName": "$ROLE_NAME",
    "roleArn": "${ROLE_ARN:-}",
    "httpApiId": "${HTTP_API_ID:-}",
    "httpApiName": "$HTTP_API_NAME",
    "wsApiId": "${WS_API_ID:-}",
    "wsApiName": "$WS_API_NAME",
    "region": "$REGION",
    "accountId": "$ACCOUNT_ID",
    "stage": "$STAGE"
}
EOF
}

load_state() {
    if [[ -f "$STATE_FILE" ]]; then
        ROLE_ARN=$(jq -r '.roleArn // empty' "$STATE_FILE")
        HTTP_API_ID=$(jq -r '.httpApiId // empty' "$STATE_FILE")
        WS_API_ID=$(jq -r '.wsApiId // empty' "$STATE_FILE")
        return 0
    fi
    return 1
}

# ─── DESTROY ──────────────────────────────────────────────────
destroy() {
    log "Starting destroy..."

    if ! load_state; then
        warn "No state file found at $STATE_FILE"
        warn "Attempting to discover resources by name..."
    fi

    # Delete Lambda function
    if $AWS lambda get-function --function-name "$FUNCTION_NAME" &>/dev/null; then
        log "Deleting Lambda function: $FUNCTION_NAME"
        $AWS lambda delete-function --function-name "$FUNCTION_NAME"
    else
        info "Lambda function $FUNCTION_NAME not found, skipping"
    fi

    # Delete HTTP API Gateway
    if [[ -z "${HTTP_API_ID:-}" ]]; then
        HTTP_API_ID=$($AWS apigatewayv2 get-apis --query "Items[?Name=='$HTTP_API_NAME'].ApiId | [0]" --output text 2>/dev/null || echo "None")
    fi
    if [[ -n "$HTTP_API_ID" && "$HTTP_API_ID" != "None" ]]; then
        log "Deleting HTTP API Gateway: $HTTP_API_ID"
        $AWS apigatewayv2 delete-api --api-id "$HTTP_API_ID"
    else
        info "HTTP API Gateway not found, skipping"
    fi

    # Delete WebSocket API Gateway
    if [[ -z "${WS_API_ID:-}" ]]; then
        WS_API_ID=$($AWS apigatewayv2 get-apis --query "Items[?Name=='$WS_API_NAME'].ApiId | [0]" --output text 2>/dev/null || echo "None")
    fi
    if [[ -n "$WS_API_ID" && "$WS_API_ID" != "None" ]]; then
        log "Deleting WebSocket API Gateway: $WS_API_ID"
        $AWS apigatewayv2 delete-api --api-id "$WS_API_ID"
    else
        info "WebSocket API Gateway not found, skipping"
    fi

    # Delete IAM Role (detach policies first)
    if $AWS iam get-role --role-name "$ROLE_NAME" &>/dev/null; then
        log "Cleaning up IAM role: $ROLE_NAME"

        # Detach managed policies
        POLICIES=$($AWS iam list-attached-role-policies --role-name "$ROLE_NAME" --query 'AttachedPolicies[].PolicyArn' --output text)
        for policy_arn in $POLICIES; do
            log "  Detaching policy: $policy_arn"
            $AWS iam detach-role-policy --role-name "$ROLE_NAME" --policy-arn "$policy_arn"
        done

        # Delete inline policies
        INLINE=$($AWS iam list-role-policies --role-name "$ROLE_NAME" --query 'PolicyNames[]' --output text)
        for policy_name in $INLINE; do
            log "  Deleting inline policy: $policy_name"
            $AWS iam delete-role-policy --role-name "$ROLE_NAME" --policy-name "$policy_name"
        done

        log "Deleting IAM role: $ROLE_NAME"
        $AWS iam delete-role --role-name "$ROLE_NAME"
    else
        info "IAM role $ROLE_NAME not found, skipping"
    fi

    # Clean up state file
    rm -f "$STATE_FILE"
    rm -rf "$SCRIPT_DIR/dist"

    log "Destroy complete!"
}

# ─── DEPLOY ───────────────────────────────────────────────────
deploy() {
    # Step 1: Package the pre-built artifact
    BUILD_DIR="$EXAMPLE_DIR/.nux/production/${MODULE_NAME}"
    if [[ ! -f "$BUILD_DIR/index.mjs" ]]; then
        error "Build artifact not found at $BUILD_DIR/index.mjs. Run 'yarn build' first."
    fi

    mkdir -p "$SCRIPT_DIR/dist"
    cd "$BUILD_DIR"
    zip -j "$SCRIPT_DIR/dist/lambda.zip" index.mjs index.mjs.map $(ls *.js *.json 2>/dev/null || true)
    cd "$SCRIPT_DIR"
    log "Bundle packaged: dist/lambda.zip"

    # Step 2: Create IAM Role
    ROLE_ARN=""
    if $AWS iam get-role --role-name "$ROLE_NAME" &>/dev/null; then
        ROLE_ARN=$($AWS iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
        log "IAM role already exists: $ROLE_ARN"
    else
        log "Creating IAM execution role: $ROLE_NAME"
        TRUST_POLICY='{
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": { "Service": "lambda.amazonaws.com" },
                "Action": "sts:AssumeRole"
            }]
        }'
        ROLE_ARN=$($AWS iam create-role \
            --role-name "$ROLE_NAME" \
            --assume-role-policy-document "$TRUST_POLICY" \
            --query 'Role.Arn' --output text)

        # Attach basic execution policy
        $AWS iam attach-role-policy \
            --role-name "$ROLE_NAME" \
            --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"

        # Add execute-api permission for WebSocket sendToClient (PostToConnection)
        $AWS iam put-role-policy \
            --role-name "$ROLE_NAME" \
            --policy-name "websocket-management" \
            --policy-document '{
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Action": "execute-api:ManageConnections",
                    "Resource": "arn:aws:execute-api:'"$REGION"':'"$ACCOUNT_ID"':*/*/@connections/*"
                }]
            }'

        log "Waiting for IAM role to propagate..."
        sleep 10
    fi

    # Step 3: Create or update Lambda function
    if $AWS lambda get-function --function-name "$FUNCTION_NAME" &>/dev/null; then
        log "Updating Lambda function code..."
        $AWS lambda update-function-code \
            --function-name "$FUNCTION_NAME" \
            --zip-file "fileb://dist/lambda.zip" \
            --query 'FunctionArn' --output text

        # Wait for update to complete before changing config
        $AWS lambda wait function-updated --function-name "$FUNCTION_NAME"
    else
        log "Creating Lambda function: $FUNCTION_NAME"
        $AWS lambda create-function \
            --function-name "$FUNCTION_NAME" \
            --runtime "nodejs20.x" \
            --handler "index.handler" \
            --role "$ROLE_ARN" \
            --zip-file "fileb://dist/lambda.zip" \
            --timeout 30 \
            --memory-size 256 \
            --environment "Variables={NODE_OPTIONS=--experimental-vm-modules}" \
            --query 'FunctionArn' --output text

        $AWS lambda wait function-active --function-name "$FUNCTION_NAME"
    fi

    LAMBDA_ARN=$($AWS lambda get-function --function-name "$FUNCTION_NAME" --query 'Configuration.FunctionArn' --output text)
    log "Lambda ARN: $LAMBDA_ARN"

    # Step 4: Create HTTP API Gateway
    HTTP_API_ID=$($AWS apigatewayv2 get-apis --query "Items[?Name=='$HTTP_API_NAME'].ApiId | [0]" --output text 2>/dev/null || echo "None")

    if [[ "$HTTP_API_ID" == "None" || -z "$HTTP_API_ID" ]]; then
        log "Creating HTTP API Gateway: $HTTP_API_NAME"
        HTTP_API_ID=$($AWS apigatewayv2 create-api \
            --name "$HTTP_API_NAME" \
            --protocol-type HTTP \
            --query 'ApiId' --output text)

        # Create Lambda integration
        HTTP_INTEGRATION_ID=$($AWS apigatewayv2 create-integration \
            --api-id "$HTTP_API_ID" \
            --integration-type AWS_PROXY \
            --integration-uri "$LAMBDA_ARN" \
            --payload-format-version "2.0" \
            --query 'IntegrationId' --output text)

        # Create routes: GET /v1/me and POST /v1/me
        for route in "GET /v1/me" "POST /v1/me"; do
            $AWS apigatewayv2 create-route \
                --api-id "$HTTP_API_ID" \
                --route-key "$route" \
                --target "integrations/$HTTP_INTEGRATION_ID" \
                --query 'RouteId' --output text
            log "  Route created: $route"
        done

        # Create stage with auto-deploy
        $AWS apigatewayv2 create-stage \
            --api-id "$HTTP_API_ID" \
            --stage-name "$STAGE" \
            --auto-deploy \
            --query 'StageName' --output text

        # Add Lambda permission for HTTP API
        $AWS lambda add-permission \
            --function-name "$FUNCTION_NAME" \
            --statement-id "http-api-invoke-${STAGE}" \
            --action "lambda:InvokeFunction" \
            --principal "apigateway.amazonaws.com" \
            --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${HTTP_API_ID}/*" \
            &>/dev/null || true

        log "HTTP API created: $HTTP_API_ID"
    else
        log "HTTP API already exists: $HTTP_API_ID"
    fi

    HTTP_ENDPOINT="https://${HTTP_API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}"

    # Step 5: Create WebSocket API Gateway
    WS_API_ID=$($AWS apigatewayv2 get-apis --query "Items[?Name=='$WS_API_NAME'].ApiId | [0]" --output text 2>/dev/null || echo "None")

    if [[ "$WS_API_ID" == "None" || -z "$WS_API_ID" ]]; then
        log "Creating WebSocket API Gateway: $WS_API_NAME"
        WS_API_ID=$($AWS apigatewayv2 create-api \
            --name "$WS_API_NAME" \
            --protocol-type WEBSOCKET \
            --route-selection-expression '$request.body.action' \
            --query 'ApiId' --output text)

        # Create Lambda integration for WebSocket
        WS_INTEGRATION_ID=$($AWS apigatewayv2 create-integration \
            --api-id "$WS_API_ID" \
            --integration-type AWS_PROXY \
            --integration-uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
            --query 'IntegrationId' --output text)

        # Create WebSocket routes
        for route_key in '$connect' '$disconnect' '$default'; do
            $AWS apigatewayv2 create-route \
                --api-id "$WS_API_ID" \
                --route-key "$route_key" \
                --target "integrations/$WS_INTEGRATION_ID" \
                --query 'RouteId' --output text
            log "  WS Route created: $route_key"
        done

        # Deploy WebSocket API (one-way: server pushes only via sendToClient, no auto-reply)
        $AWS apigatewayv2 create-stage \
            --api-id "$WS_API_ID" \
            --stage-name "$STAGE" \
            --auto-deploy \
            --query 'StageName' --output text

        # Add Lambda permission for WebSocket API
        $AWS lambda add-permission \
            --function-name "$FUNCTION_NAME" \
            --statement-id "ws-api-invoke-${STAGE}" \
            --action "lambda:InvokeFunction" \
            --principal "apigateway.amazonaws.com" \
            --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${WS_API_ID}/*" \
            &>/dev/null || true

        log "WebSocket API created: $WS_API_ID"
    else
        log "WebSocket API already exists: $WS_API_ID"
    fi

    WS_ENDPOINT="wss://${WS_API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}"
    WS_MANAGEMENT_ENDPOINT="https://${WS_API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}"

    # Step 6: Update Lambda environment with WebSocket endpoint
    log "Updating Lambda environment variables..."
    $AWS lambda update-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --environment "Variables={WEBSOCKET_API_ENDPOINT=${WS_MANAGEMENT_ENDPOINT},NODE_OPTIONS=--experimental-vm-modules}" \
        --query 'FunctionArn' --output text &>/dev/null

    # Save state
    save_state

    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN} Deployment Complete!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}HTTP API Endpoint:${NC}"
    echo -e "    GET  ${HTTP_ENDPOINT}/v1/me"
    echo -e "    POST ${HTTP_ENDPOINT}/v1/me"
    echo ""
    echo -e "  ${CYAN}WebSocket Endpoint:${NC}"
    echo -e "    ${WS_ENDPOINT}"
    echo ""
    echo -e "  ${CYAN}Test HTTP:${NC}"
    echo -e "    curl ${HTTP_ENDPOINT}/v1/me"
    echo -e "    curl -X POST ${HTTP_ENDPOINT}/v1/me -d '{\"name\":\"test\"}'"
    echo ""
    echo -e "  ${CYAN}Test WebSocket:${NC}"
    echo -e "    wscat -c ${WS_ENDPOINT}"
    echo ""
    echo -e "  ${CYAN}Destroy:${NC}"
    echo -e "    $0 destroy --profile $PROFILE --region $REGION --stage $STAGE"
    echo ""
}

# ─── MAIN ─────────────────────────────────────────────────────
case "$ACTION" in
    deploy)  deploy ;;
    destroy) destroy ;;
    *)       usage ;;
esac
