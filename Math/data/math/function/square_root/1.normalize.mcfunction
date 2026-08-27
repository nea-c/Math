data modify storage math:internal x set compute default math:square_root/normalize/compare_below_one/00
execute if predicate math:internal/comparison/x_negative_integer run return run function math:square_root/2.normalize_scale_up
data modify storage math:internal x set compute default math:square_root/normalize/compare_at_least_four/00
execute unless predicate math:internal/comparison/x_negative_integer run return run function math:square_root/3.normalize_scale_down
return 1
