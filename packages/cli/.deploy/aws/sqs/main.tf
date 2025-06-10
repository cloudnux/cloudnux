# SQS Trigger Module - main.tf

data "aws_sqs_queue" "this" {
  for_each = var.event_sources
  name     = each.value.queue_name
}

data "aws_sqs_queue" "dlq" {
  for_each = var.event_sources
  name     = "${each.value.queue_name}-dlq"
}

resource "aws_lambda_event_source_mapping" "sqs" {
  for_each = var.event_sources

  event_source_arn = data.aws_sqs_queue.this[each.key].arn
  function_name    = var.lambda_name
  enabled          = try(each.value.enabled, true)

  # SQS specific configurations
  batch_size                         = try(each.value.batch_size, 10)
  maximum_batching_window_in_seconds = try(each.value.maximum_batching_window_in_seconds, null)

  lifecycle {
    create_before_destroy = true
  }
}

# # Grant Lambda permission to be invoked by SQS
# resource "aws_lambda_permission" "allow_sqs" {
#   for_each = var.event_sources

#   statement_id  = "AllowExecutionFromSQS-${each.key}"
#   action        = "lambda:InvokeFunction"
#   function_name = var.lambda_name
#   principal     = "sqs.amazonaws.com"
#   source_arn    = data.aws_sqs_queue.this[each.key].arn
# }
