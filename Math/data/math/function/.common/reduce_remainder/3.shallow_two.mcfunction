data modify storage math: internal.w_comparison.predicate.rounding_remainder_y_too_large_to_double set compute default float math:.validation/predicate/rounding/remainder/y_too_large_to_double/value
execute if predicate math:.validation/rounding/remainder/y_too_large_to_double run data modify storage math: internal.x set compute default float math:.common/sub
execute if predicate math:.validation/rounding/remainder/y_too_large_to_double run return run function math:.common/reduce_remainder/5.finish_two
data modify storage math: internal.w set compute default float math:.common/rounding/double_y
data modify storage math: internal.w_comparison.predicate.rounding_remainder_w_greater_than_x set compute default float math:.validation/predicate/rounding/remainder/w_greater_than_x/value
execute if predicate math:.validation/rounding/remainder/w_greater_than_x run data modify storage math: internal.x set compute default float math:.common/sub
execute if predicate math:.validation/rounding/remainder/w_greater_than_x run return run function math:.common/reduce_remainder/5.finish_two
return 1
