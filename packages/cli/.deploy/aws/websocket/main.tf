locals {
  # Map event names to their standard WebSocket route keys
  event_to_route_key = {
    connect    = "$connect"
    disconnect = "$disconnect"
    message    = "$default"
  }

  # Resolve each route's route_key: explicit override > event-based default
  resolved_routes = {
    for k, v in var.routes : k => merge(v, {
      resolved_key = coalesce(try(v.route_key, null), lookup(local.event_to_route_key, v.event, "$default"))
    })
  }
}

data "aws_apigatewayv2_api" "this" {
  api_id = var.api_gateway_id
}

resource "aws_apigatewayv2_integration" "this" {
  for_each = var.routes

  api_id                    = var.api_gateway_id
  integration_type          = "AWS_PROXY"
  integration_uri           = var.lambda_arn
  content_handling_strategy = "CONVERT_TO_TEXT"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_apigatewayv2_route" "this" {
  for_each = local.resolved_routes

  api_id    = var.api_gateway_id
  route_key = each.value.resolved_key
  target    = "integrations/${aws_apigatewayv2_integration.this[each.key].id}"
}

# # Grant Lambda permission to be invoked by this WebSocket API Gateway
# resource "aws_lambda_permission" "this" {
#   statement_id  = "AllowWebSocketAPIGateway-${var.lambda_name}"
#   action        = "lambda:InvokeFunction"
#   function_name = var.lambda_name
#   principal     = "apigateway.amazonaws.com"
#   source_arn    = "${data.aws_apigatewayv2_api.this.execution_arn}/*/*"
# }
