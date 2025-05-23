data "aws_apigatewayv2_api" "this" {
  api_id = var.api_gateway_id
}

resource "aws_apigatewayv2_route" "this" {
  for_each = var.entrypoints

  api_id    = var.api_gateway_id
  route_key = "${upper(each.value.method)} ${each.value.path}"

  authorization_type = try(each.value.authorization_type, "NONE")
  authorizer_id      = try(each.value.authorizer_id, null)

  operation_name = each.key
  target         = "integrations/${aws_apigatewayv2_integration.this[each.key].id}"
}

resource "aws_apigatewayv2_integration" "this" {
  for_each = var.entrypoints

  api_id      = var.api_gateway_id
  description = try(each.value.description, null)

  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = var.lambda_arn
  connection_type    = "INTERNET"

  payload_format_version = "2.0"
  timeout_milliseconds   = try(each.value.timeout, null)

  lifecycle {
    create_before_destroy = true
  }
}
