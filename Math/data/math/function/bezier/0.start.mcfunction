data remove storage math: error
data modify storage math: internal.w_validation_a set compute default float math:.validation/finite/a
execute unless data storage math: {internal:{w_validation_a:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_validation_b set compute default float math:.validation/finite/b
execute unless data storage math: {internal:{w_validation_b:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_validation_t set compute default float math:.validation/finite/t
execute unless data storage math: {internal:{w_validation_t:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_validation_max set compute default float math:.validation/finite/max
execute unless data storage math: {internal:{w_validation_max:0.0f}} run return run function math:.common/_error/invalid_number
execute unless data storage math: curve[3] run return run function math:.common/_error/invalid_curve
execute if data storage math: curve[4] run return run function math:.common/_error/invalid_curve
execute store success storage math: internal.w_validation_curve_numeric_0 byte 1 run data get storage math: curve[0] 1
execute unless data storage math: {internal:{w_validation_curve_numeric_0:1b}} run return run function math:.common/_error/invalid_curve
execute store success storage math: internal.w_validation_curve_numeric_1 byte 1 run data get storage math: curve[1] 1
execute unless data storage math: {internal:{w_validation_curve_numeric_1:1b}} run return run function math:.common/_error/invalid_curve
execute store success storage math: internal.w_validation_curve_numeric_2 byte 1 run data get storage math: curve[2] 1
execute unless data storage math: {internal:{w_validation_curve_numeric_2:1b}} run return run function math:.common/_error/invalid_curve
execute store success storage math: internal.w_validation_curve_numeric_3 byte 1 run data get storage math: curve[3] 1
execute unless data storage math: {internal:{w_validation_curve_numeric_3:1b}} run return run function math:.common/_error/invalid_curve
data modify storage math: internal.w_bezier_x1 set from storage math: curve[0]
data modify storage math: internal.w_bezier_y1 set from storage math: curve[1]
data modify storage math: internal.w_bezier_x2 set from storage math: curve[2]
data modify storage math: internal.w_bezier_y2 set from storage math: curve[3]
data remove storage math: internal.w_validation_curve_0
data modify storage math: internal.w_validation_curve_0 set compute default float math:.validation/finite/curve_0
execute unless data storage math: internal.w_validation_curve_0 run return run function math:.common/_error/invalid_curve
execute unless data storage math: {internal:{w_validation_curve_0:0.0f}} run return run function math:.common/_error/invalid_number
data remove storage math: internal.w_validation_curve_1
data modify storage math: internal.w_validation_curve_1 set compute default float math:.validation/finite/curve_1
execute unless data storage math: internal.w_validation_curve_1 run return run function math:.common/_error/invalid_curve
execute unless data storage math: {internal:{w_validation_curve_1:0.0f}} run return run function math:.common/_error/invalid_number
data remove storage math: internal.w_validation_curve_2
data modify storage math: internal.w_validation_curve_2 set compute default float math:.validation/finite/curve_2
execute unless data storage math: internal.w_validation_curve_2 run return run function math:.common/_error/invalid_curve
execute unless data storage math: {internal:{w_validation_curve_2:0.0f}} run return run function math:.common/_error/invalid_number
data remove storage math: internal.w_validation_curve_3
data modify storage math: internal.w_validation_curve_3 set compute default float math:.validation/finite/curve_3
execute unless data storage math: internal.w_validation_curve_3 run return run function math:.common/_error/invalid_curve
execute unless data storage math: {internal:{w_validation_curve_3:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_comparison.predicate.bezier_duration_positive set compute default float math:.validation/predicate/bezier/duration_positive/value
execute unless predicate math:.validation/bezier/duration_positive run return run function math:.common/_error/invalid_duration
data modify storage math: internal.w_comparison.predicate.bezier_x1_in_range set compute default float math:.validation/predicate/bezier/x1_in_range/value
execute unless predicate math:.validation/bezier/x1_in_range run return run function math:.common/_error/invalid_curve
data modify storage math: internal.w_comparison.predicate.bezier_x2_in_range set compute default float math:.validation/predicate/bezier/x2_in_range/value
execute unless predicate math:.validation/bezier/x2_in_range run return run function math:.common/_error/invalid_curve
data modify storage math: internal.w_comparison.predicate.bezier_time_at_or_below_start set compute default float math:.validation/predicate/bezier/time_at_or_below_start/value
execute if predicate math:.validation/bezier/time_at_or_below_start run data modify storage math: ans set from storage math: a
execute if predicate math:.validation/bezier/time_at_or_below_start run return 1
data modify storage math: internal.w_comparison.predicate.bezier_time_at_or_after_end set compute default float math:.validation/predicate/bezier/time_at_or_after_end/value
execute if predicate math:.validation/bezier/time_at_or_after_end run data modify storage math: ans set from storage math: b
execute if predicate math:.validation/bezier/time_at_or_after_end run return 1
data modify storage math: internal.x set from storage math: max
data modify storage math: internal.y set from storage math: t
function math:.common/reciprocal/0.start
data modify storage math: internal.w_bezier_u set from storage math: internal.x
data modify storage math: internal.w_bezier_low set value 0.0f
data modify storage math: internal.w_bezier_high set value 1.0f
function math:bezier/1.solve
return run function math:bezier/2.finish
