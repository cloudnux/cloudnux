variable "schedules" {
  description = "A map of objects with EventBridge Schedule definitions."
  type = map(object({
    name                      = string
    pattern                   = string
    description               = optional(string)
    timezone                  = optional(string, "Europe/Stockholm")
    state                     = optional(string, "ENABLED")
    use_flexible_time_window  = optional(bool, false)
    maximum_window_in_minutes = optional(number)
  }))
}
variable "component" {
  description = "The name of the component."
  type        = string
}

variable "target_arn" {
  description = "The ARN of the Lambda function."
  type        = string
}
