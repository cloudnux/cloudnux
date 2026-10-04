# SNS Trigger Module - main.tf

data "aws_sns_topic" "this" {
  for_each = var.event_sources
  name     = each.value.topic_name
}

resource "aws_sns_topic_subscription" "this" {
  for_each = var.event_sources

  topic_arn = data.aws_sns_topic.this[each.key].arn
  protocol  = "lambda"
  endpoint  = var.lambda_arn

  filter_policy       = try(each.value.filter_policy, null)
  filter_policy_scope = try(each.value.filter_policy, null) != null ? try(each.value.filter_policy_scope, "MessageAttributes") : null

  lifecycle {
    create_before_destroy = true
  }
}

# SNS (unlike SQS event source mappings) requires an explicit resource-based
# permission for the topic to invoke the Lambda function.
resource "aws_lambda_permission" "allow_sns" {
  for_each = var.event_sources

  statement_id  = "AllowExecutionFromSNS-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_name
  principal     = "sns.amazonaws.com"
  source_arn    = data.aws_sns_topic.this[each.key].arn
}
