#!/usr/bin/env bash
# Throwaway Azure resources for `yarn test:live`.
#
#   scripts/live-env.sh up      create a resource group with storage, Service Bus, Maps and email,
#                               write .env.live (keys; git-ignored), grant your user data roles
#   scripts/live-env.sh email   add Communication Services email to an environment made before it existed
#   scripts/live-env.sh roles   (re)grant the data roles used by `yarn test:live:entra`
#   scripts/live-env.sh down    delete the resource group and .env.live
#
# Needs the Azure CLI, logged in (`az login`) to the subscription to use.
# Optional: LIVE_LOCATION (default swedencentral), LIVE_MAPS_LOCATION (default westeurope),
#           LIVE_EMAIL_TO (an inbox you own; the email send test is skipped without it).
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE=.env.live
LOCATION="${LIVE_LOCATION:-swedencentral}"
MAPS_LOCATION="${LIVE_MAPS_LOCATION:-westeurope}"

die() { echo "error: $*" >&2; exit 1; }
step() { echo "• $*"; }

command -v az >/dev/null 2>&1 || die "Azure CLI (az) not found"
az account show -o none 2>/dev/null || die "not logged in: run 'az login' first"

load_env() {
    [ -f "$ENV_FILE" ] || die "$ENV_FILE not found: run '$0 up' first"
    # shellcheck disable=SC1090
    . "./$ENV_FILE"
}

roles() {
    load_env
    local me sa_id ns_id maps_id
    me=$(az ad signed-in-user show --query id -o tsv) || die "could not read the signed-in user (roles need a user login)"
    sa_id=$(az storage account show -n "$LIVE_STORAGE_ACCOUNT" -g "$LIVE_RESOURCE_GROUP" --query id -o tsv)
    ns_id=$(az servicebus namespace show -n "$LIVE_SERVICEBUS_NAMESPACE" -g "$LIVE_RESOURCE_GROUP" --query id -o tsv)
    maps_id=$(az resource show -g "$LIVE_RESOURCE_GROUP" -n "$LIVE_MAPS_ACCOUNT" --resource-type Microsoft.Maps/accounts --query id -o tsv)

    grant() {
        step "role: $1"
        az role assignment create --assignee-object-id "$me" --assignee-principal-type User \
            --role "$1" --scope "$2" -o none
    }
    grant "Storage Blob Data Contributor" "$sa_id"
    grant "Azure Service Bus Data Owner" "$ns_id"
    grant "Azure Maps Data Reader" "$maps_id"
    if [ -n "${LIVE_COMMUNICATION_ACCOUNT:-}" ]; then
        grant "Communication and Email Service Owner" \
            "$(az communication show -n "$LIVE_COMMUNICATION_ACCOUNT" -g "$LIVE_RESOURCE_GROUP" --query id -o tsv)"
    fi
    echo "Roles granted. They can take a few minutes to apply before 'yarn test:live:entra' passes."
}

up() {
    [ -f "$ENV_FILE" ] && die "$ENV_FILE already exists: run '$0 down' first"

    local suffix rg sa ns maps sa_cs sb_cs maps_id maps_key maps_client_id
    suffix="${RANDOM}${RANDOM}"
    rg="cloudnux-live-$suffix"
    sa="cnxlive$suffix"          # 3–24 lowercase letters/digits
    ns="cnx-live-$suffix"
    maps="cnx-live-maps-$suffix"

    echo "Subscription: $(az account show --query name -o tsv)"
    step "resource group $rg ($LOCATION)"
    az group create -n "$rg" -l "$LOCATION" -o none

    step "storage account $sa + container 'test'"
    az storage account create -n "$sa" -g "$rg" -l "$LOCATION" --sku Standard_LRS --kind StorageV2 \
        --min-tls-version TLS1_2 --allow-blob-public-access false -o none
    sa_cs=$(az storage account show-connection-string -n "$sa" -g "$rg" -o tsv)
    az storage container create -n test --connection-string "$sa_cs" -o none

    step "service bus namespace $ns (Standard) + queue 'orders', topic 'events', subscription 'billing'"
    az servicebus namespace create -n "$ns" -g "$rg" -l "$LOCATION" --sku Standard -o none
    az servicebus queue create -n orders --namespace-name "$ns" -g "$rg" -o none
    az servicebus topic create -n events --namespace-name "$ns" -g "$rg" -o none
    az servicebus topic subscription create -n billing --topic-name events --namespace-name "$ns" -g "$rg" -o none
    sb_cs=$(az servicebus namespace authorization-rule keys list -g "$rg" --namespace-name "$ns" \
        -n RootManageSharedAccessKey --query primaryConnectionString -o tsv)

    step "maps account $maps (Gen2, $MAPS_LOCATION)"
    maps_id=$(az resource create -g "$rg" -n "$maps" --resource-type Microsoft.Maps/accounts --is-full-object \
        --properties "{\"location\":\"$MAPS_LOCATION\",\"sku\":{\"name\":\"G2\"},\"kind\":\"Gen2\",\"properties\":{}}" \
        --query id -o tsv)
    maps_key=$(az rest --method post --url "https://management.azure.com${maps_id}/listKeys?api-version=2021-02-01" \
        --query primaryKey -o tsv)
    maps_client_id=$(az resource show --ids "$maps_id" --query properties.uniqueId -o tsv)

    umask 077
    cat > "$ENV_FILE" <<EOF
# Written by scripts/live-env.sh. Holds keys: git-ignored, delete with '$0 down'.
LIVE_RESOURCE_GROUP="$rg"
LIVE_STORAGE_ACCOUNT="$sa"
LIVE_STORAGE_CONTAINER="test"
LIVE_SERVICEBUS_NAMESPACE="$ns"
LIVE_SERVICEBUS_QUEUE="orders"
LIVE_SERVICEBUS_TOPIC="events"
LIVE_SERVICEBUS_SUBSCRIPTION="billing"
LIVE_MAPS_ACCOUNT="$maps"
AZURE_STORAGE_CONNECTION_STRING="$sa_cs"
AZURE_SERVICEBUS_CONNECTION_STRING="$sb_cs"
AZURE_MAPS_KEY="$maps_key"
AZURE_MAPS_CLIENT_ID="$maps_client_id"
EOF
    email_resources "$rg" "$suffix"
    echo "Wrote $ENV_FILE"

    roles || echo "warning: data roles not granted; 'yarn test:live' works, 'yarn test:live:entra' won't until '$0 roles' succeeds" >&2

    echo
    echo "Next: yarn test:live         (keys / connection strings)"
    echo "      yarn test:live:entra   (DefaultAzureCredential via az login)"
    echo "Done: $0 down"
}

# Communication Services resource + Email service with an Azure-managed domain
# (DoNotReply@<random>.azurecomm.net), linked together. Appends to .env.live.
email_resources() {
    local rg="$1" suffix="$2"
    local acs="cnx-live-acs-$suffix" ecs="cnx-live-mail-$suffix"
    local acs_id domain_id sender_domain host acs_cs

    az extension add --name communication --upgrade --only-show-errors -o none

    step "communication services $acs + email service $ecs with an Azure-managed domain (data location Europe)"
    acs_id=$(az communication create -n "$acs" -g "$rg" --location Global --data-location Europe --query id -o tsv)
    az communication email create -n "$ecs" -g "$rg" --location Global --data-location Europe -o none
    domain_id=$(az communication email domain create --domain-name AzureManagedDomain --email-service-name "$ecs" \
        -g "$rg" --location Global --domain-management AzureManaged --query id -o tsv)
    sender_domain=$(az communication email domain show --domain-name AzureManagedDomain --email-service-name "$ecs" \
        -g "$rg" --query mailFromSenderDomain -o tsv)

    step "link the domain to $acs"
    az rest --method patch --url "https://management.azure.com${acs_id}?api-version=2023-03-31" \
        --body "{\"properties\":{\"linkedDomains\":[\"$domain_id\"]}}" -o none

    host=$(az communication show -n "$acs" -g "$rg" --query hostName -o tsv)   # <name>.europe.communication.azure.com
    acs_cs=$(az communication list-key -n "$acs" -g "$rg" --query primaryConnectionString -o tsv)

    cat >> "$ENV_FILE" <<EOF
LIVE_COMMUNICATION_ACCOUNT="$acs"
AZURE_COMMUNICATION_RESOURCE="${host%.communication.azure.com}"
AZURE_COMMUNICATION_CONNECTION_STRING="$acs_cs"
LIVE_EMAIL_FROM="DoNotReply@$sender_domain"
LIVE_EMAIL_TO="${LIVE_EMAIL_TO:-}"
EOF
    [ -n "${LIVE_EMAIL_TO:-}" ] || echo "note: set LIVE_EMAIL_TO in $ENV_FILE to an inbox you own to run the send test"
}

# For an environment created before email was part of 'up'.
email() {
    load_env
    [ -z "${LIVE_COMMUNICATION_ACCOUNT:-}" ] || die "email is already set up ($LIVE_COMMUNICATION_ACCOUNT)"
    umask 077
    email_resources "$LIVE_RESOURCE_GROUP" "${LIVE_RESOURCE_GROUP#cloudnux-live-}"
    roles || echo "warning: data roles not granted; run '$0 roles' to retry" >&2
}

down() {
    load_env
    step "deleting resource group $LIVE_RESOURCE_GROUP (runs in the background)"
    az group delete -n "$LIVE_RESOURCE_GROUP" --yes --no-wait
    rm -f "$ENV_FILE"
    echo "Removed $ENV_FILE"
}

case "${1:-}" in
    up) up ;;
    roles) roles ;;
    email) email ;;
    down) down ;;
    *) echo "usage: $0 up | roles | email | down" >&2; exit 2 ;;
esac
