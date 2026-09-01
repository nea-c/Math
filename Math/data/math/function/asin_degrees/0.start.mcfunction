data remove storage math: error
data remove storage math: ans
data modify storage math: internal.x set compute default float math:.common/input/a
data modify storage math: internal.w_comparison.predicate.inverse_trigonometry_input_in_range set compute default float math:.validation/predicate/inverse_trigonometry/input_in_range/value
execute if predicate math:.validation/inverse_trigonometry/input_in_range run function math:.common/asin/0.start
execute if predicate math:.validation/inverse_trigonometry/input_in_range run data modify storage math: internal.x set compute default float math:.common/deg
execute if predicate math:.validation/inverse_trigonometry/input_in_range run data modify storage math: ans set from storage math: internal.x
data remove storage math: internal
