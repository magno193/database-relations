import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) {
      throw new AppError('Cliente não encontrado com o id');
    }

    const productsIds = products.map(product => {
      return { id: product.id };
    });

    const productsExists = await this.productsRepository.findAllById(
      productsIds,
    );
    if (!productsExists.length) {
      throw new AppError('Não foram encontrados produtos válidos!');
    }

    const invalidProducts = products.find(product => product.quantity < 1);
    if (invalidProducts) {
      throw new AppError(`Produto ${invalidProducts.id} sem estoque!`);
    }

    const validProducts = products.map(product => {
      const findProduct = productsExists.find(
        productExists => productExists.id === product.id,
      );

      if (!findProduct) {
        throw new AppError(`Produto ${product.id} não encontrado!`);
      }

      if (product.quantity > findProduct.quantity) {
        throw new AppError(
          `Não há estoque suficiente de ${findProduct.name} para realizar este pedido.`,
        );
      }

      const quantityDiference = findProduct.quantity - product.quantity;
      findProduct.quantity = quantityDiference;
      return {
        product_id: product.id,
        price: findProduct.price || 0,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: validProducts,
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateOrderService;
