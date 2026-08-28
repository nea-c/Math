data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_b set compute default math:internal/comparison/finite/b
execute unless data storage math:internal {w_validation_b:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_t set compute default math:internal/comparison/finite/t
execute unless data storage math:internal {w_validation_t:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_max set compute default math:internal/comparison/finite/max
execute unless data storage math:internal {w_validation_max:0.0f} run return run function math:.common/_error/invalid_number
execute unless data storage math: curve[3] run return run function math:.common/_error/invalid_curve
execute if data storage math: curve[4] run return run function math:.common/_error/invalid_curve
data remove storage math:internal w_bezier_x1
data modify storage math:internal w_bezier_x1 set compute default math:bezier/input/x1
execute unless data storage math:internal w_bezier_x1 run return run function math:.common/_error/invalid_curve
data modify storage math:internal w_bezier_curve_macro.x1 set from storage math:internal w_bezier_x1
data remove storage math:internal w_bezier_y1
data modify storage math:internal w_bezier_y1 set compute default math:bezier/input/y1
execute unless data storage math:internal w_bezier_y1 run return run function math:.common/_error/invalid_curve
data modify storage math:internal w_bezier_curve_macro.y1 set from storage math:internal w_bezier_y1
data remove storage math:internal w_bezier_x2
data modify storage math:internal w_bezier_x2 set compute default math:bezier/input/x2
execute unless data storage math:internal w_bezier_x2 run return run function math:.common/_error/invalid_curve
data modify storage math:internal w_bezier_curve_macro.x2 set from storage math:internal w_bezier_x2
data remove storage math:internal w_bezier_y2
data modify storage math:internal w_bezier_y2 set compute default math:bezier/input/y2
execute unless data storage math:internal w_bezier_y2 run return run function math:.common/_error/invalid_curve
data modify storage math:internal w_bezier_curve_macro.y2 set from storage math:internal w_bezier_y2
data modify storage math:internal w_validation_curve_type set value 0b
function math:bezier/1.validate_curve with storage math:internal w_bezier_curve_macro
execute unless data storage math:internal {w_validation_curve_type:1b} run return run function math:.common/_error/invalid_curve
data remove storage math:internal w_validation_curve_0
data modify storage math:internal w_validation_curve_0 set compute default math:internal/comparison/finite/curve_0
execute unless data storage math:internal w_validation_curve_0 run return run function math:.common/_error/invalid_curve
execute unless data storage math:internal {w_validation_curve_0:0.0f} run return run function math:.common/_error/invalid_number
data remove storage math:internal w_validation_curve_1
data modify storage math:internal w_validation_curve_1 set compute default math:internal/comparison/finite/curve_1
execute unless data storage math:internal w_validation_curve_1 run return run function math:.common/_error/invalid_curve
execute unless data storage math:internal {w_validation_curve_1:0.0f} run return run function math:.common/_error/invalid_number
data remove storage math:internal w_validation_curve_2
data modify storage math:internal w_validation_curve_2 set compute default math:internal/comparison/finite/curve_2
execute unless data storage math:internal w_validation_curve_2 run return run function math:.common/_error/invalid_curve
execute unless data storage math:internal {w_validation_curve_2:0.0f} run return run function math:.common/_error/invalid_number
data remove storage math:internal w_validation_curve_3
data modify storage math:internal w_validation_curve_3 set compute default math:internal/comparison/finite/curve_3
execute unless data storage math:internal w_validation_curve_3 run return run function math:.common/_error/invalid_curve
execute unless data storage math:internal {w_validation_curve_3:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_comparison.predicate.bezier_duration_positive.minimum set compute default math:internal/comparison/predicate/bezier/duration_positive/minimum
execute unless predicate math:internal/bezier/duration_positive run return run function math:.common/_error/invalid_duration
data modify storage math:internal w_comparison.predicate.bezier_x1_in_range.minimum set compute default math:internal/comparison/predicate/bezier/x1_in_range/minimum
data modify storage math:internal w_comparison.predicate.bezier_x1_in_range.maximum set compute default math:internal/comparison/predicate/bezier/x1_in_range/maximum
execute unless predicate math:internal/bezier/x1_in_range run return run function math:.common/_error/invalid_curve
data modify storage math:internal w_comparison.predicate.bezier_x2_in_range.minimum set compute default math:internal/comparison/predicate/bezier/x2_in_range/minimum
data modify storage math:internal w_comparison.predicate.bezier_x2_in_range.maximum set compute default math:internal/comparison/predicate/bezier/x2_in_range/maximum
execute unless predicate math:internal/bezier/x2_in_range run return run function math:.common/_error/invalid_curve
data modify storage math:internal w_comparison.predicate.bezier_time_at_or_below_start.maximum set compute default math:internal/comparison/predicate/bezier/time_at_or_below_start/maximum
execute if predicate math:internal/bezier/time_at_or_below_start run data modify storage math: ans set from storage math: a
execute if predicate math:internal/bezier/time_at_or_below_start run return 1
data modify storage math:internal w_comparison.predicate.bezier_time_at_or_after_end.minimum set compute default math:internal/comparison/predicate/bezier/time_at_or_after_end/minimum
execute if predicate math:internal/bezier/time_at_or_after_end run data modify storage math: ans set from storage math: b
execute if predicate math:internal/bezier/time_at_or_after_end run return 1
data modify storage math:internal x set from storage math: max
data modify storage math:internal y set from storage math: t
function math:.common/reciprocal/0.start
data modify storage math:internal w_bezier_u set from storage math:internal x
data modify storage math:internal w_bezier_low set value 0.0f
data modify storage math:internal w_bezier_high set value 1.0f
function math:bezier/2.solve
return run function math:bezier/3.finish
