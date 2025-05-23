data "aws_iam_role" "eventbridge_role" {
  name = "eventbridge_execution_role"
}

resource "aws_scheduler_schedule_group" "this" {

  name = var.component

  lifecycle {
    create_before_destroy = true
  }
}


resource "aws_scheduler_schedule" "this" {
  for_each = var.schedules

  name        = each.value.name
  description = try(each.value.description, null)
  group_name  = aws_scheduler_schedule_group.this.name

  schedule_expression          = each.value.pattern
  schedule_expression_timezone = try(each.value.timezone, "UTC")

  state = try(each.value.state, "ENABLED")

  flexible_time_window {
    maximum_window_in_minutes = lookup(each.value, "maximum_window_in_minutes", null)
    mode                      = lookup(each.value, "use_flexible_time_window", false) ? "FLEXIBLE" : "OFF"
  }

  target {
    arn      = var.target_arn
    role_arn = data.aws_iam_role.eventbridge_role.arn

    dynamic "retry_policy" {
      for_each = lookup(each.value, "retry_policy", null) != null ? [
        each.value.retry_policy
      ] : []

      content {
        maximum_event_age_in_seconds = retry_policy.value.maximum_event_age_in_seconds
        maximum_retry_attempts       = retry_policy.value.maximum_retry_attempts
      }
    }
  }
}
