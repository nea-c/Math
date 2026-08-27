data modify storage math:internal x set compute default math:log/normalize/compare_below_one/00
execute if predicate math:internal/comparison/x_negative_integer run return run function math:.common/log/3.normalize_scale_up
data modify storage math:internal x set compute default math:log/normalize/compare_at_least_two/00
execute unless predicate math:internal/comparison/x_negative_integer run return run function math:.common/log/4.normalize_scale_down
return 1
