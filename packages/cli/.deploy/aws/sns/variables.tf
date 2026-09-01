variable "event_sources" {
  description = "Map of SNS event source configurations"
  type = map(object({
    topic_name          = string
    filter_policy       = optional(string)
    filter_policy_scope = optional(string, "MessageAttributes")
  }))
}

variable "lambda_name" {
  description = "Name of the Lambda function"
  type        = string
}

variable "lambda_arn" {
  description = "ARN of the Lambda function"
  type        = string
}
